// plugins/microtask-pipeline/scripts/pr-review.mjs
// Automated review of a PR with any OpenAI-compatible LLM (chat completions).
// Usage: node pr-review.mjs <PR number> [--lang <language>]   |   node pr-review.mjs --check
// --lang: review language (default English); the skill passes the PR language.
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { parseExclude, selectDiff } from "./diff-select.mjs";
import { parseLanguageArg, phrasesFor } from "./review-language.mjs";
import { isTransient, modelChain, waitSeconds } from "./retry-policy.mjs";

// Loads .env from the current folder (no dependencies). Variables already set take precedence.
function loadDotEnv(path = ".env") {
    if (!existsSync(path)) return;
    for (const raw of readFileSync(path, "utf-8").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (!match) continue;
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
        if (process.env[key] === undefined) process.env[key] = value;
    }
}

loadDotEnv();

// Positive integer from the environment; if missing or empty uses the default, if invalid warns on stdout.
function positiveIntEnv(name, fallback) {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;
    if (/^\d+$/.test(raw) && Number(raw) > 0) return Number(raw);
    console.log(`Warning: ${name}="${raw}" is not a positive integer, using the default ${fallback}.`);
    return fallback;
}

const config = {
    apiKey: process.env.PR_REVIEW_API_KEY,
    baseUrl: (process.env.PR_REVIEW_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
    model: process.env.PR_REVIEW_MODEL || "openai/gpt-oss-120b",
    // Optional: tried when the main model still fails with a transient error (429/5xx) after the retries.
    fallbackModel: process.env.PR_REVIEW_FALLBACK_MODEL?.trim() || undefined,
    // Defaults designed for Groq's free tier (8K tokens per minute on openai/gpt-oss-120b).
    maxChars: Number(process.env.PR_REVIEW_MAX_CHARS) || 16000,
    // Response token limit (max_tokens): 2048 truncated reviews mid-sentence.
    maxTokens: positiveIntEnv("PR_REVIEW_MAX_TOKENS", 4096),
    // Optional: not all OpenAI-compatible providers accept reasoning_effort.
    reasoningEffort: process.env.PR_REVIEW_REASONING_EFFORT?.trim() || undefined,
    exclude: parseExclude(process.env.PR_REVIEW_EXCLUDE),
};
const host = new URL(config.baseUrl).host;
const labelFor = (model) => `${model} @ ${host}`;
let label = labelFor(config.model);

let language, args;
try {
    ({ language, rest: args } = parseLanguageArg(process.argv.slice(2)));
} catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
}
const phrases = phrasesFor(language);

if (args[0] === "--check") {
    // Used by the SKILL at startup: tells whether the review is configured, without ever printing the key.
    if (config.apiKey) {
        console.log(`LLM review configured: ${label} (max ${config.maxTokens} tokens)` +
            (config.fallbackModel ? `, fallback ${config.fallbackModel}` : ""));
        process.exit(0);
    }
    console.log("LLM review not configured: PR_REVIEW_API_KEY missing (environment or .env).");
    process.exit(2);
}

const prNumber = args[0];
// Command injection prevention and argument validation
if (!prNumber || !/^\d+$/.test(prNumber)) {
    console.error("Error: provide a valid PR number (digits only).");
    process.exit(1);
}

function fail(message) {
    console.error(`LLM review failed (${label}): ${message}`);
    process.exit(1);
}

if (!config.apiKey) fail("PR_REVIEW_API_KEY missing (environment or .env).");

let diff;
try {
    // execFileSync with an array protects against injection
    diff = execFileSync("gh", ["pr", "diff", prNumber], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
    fail(`gh pr diff: ${error.message}`);
}

// Code first, tests last, documentation out; cut at file boundaries (provider token limit)
const selection = selectDiff(diff, { maxChars: config.maxChars, exclude: config.exclude });

const listFiles = (files, max = 30) =>
    files.slice(0, max).map((f) => `- ${f}`).join("\n") + (files.length > max ? `\n- ... and ${files.length - max} more` : "");

const missing = [];
if (selection.excluded.length) missing.push(`Excluded files (documentation or generated):\n${listFiles(selection.excluded)}`);
if (selection.omitted.length) missing.push(`Files omitted due to length limit:\n${listFiles(selection.omitted)}`);
if (selection.partial.length) missing.push(`Files only partially included (whole @@ blocks):\n${listFiles(selection.partial)}`);
const missingSection = missing.length
    ? `\nThe diff may be incomplete: do not report as an issue code that appears truncated or files you cannot see.\n\n${missing.join("\n\n")}\n`
    : "";

const prompt = `You are an expert code reviewer. Analyze the following git diff and write a Code Review in this language: ${language} (section titles included), regardless of the language of the diff, of the project and of this prompt.
Follow exactly this structure:

1. **Explanation:** Elementary (beginner-proof) explanation of what the fix or feature does.
2. **Risks and Issues:** Highlight any issues, risks or edge cases.
3. **Suggested fixes:** Any fix code formatted in Markdown, if needed (otherwise state that there are no fixes).
${missingSection}
Here is the diff:
\`\`\`diff
${selection.text}
\`\`\`
`;

const MAX_RETRIES = 2;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Calls one model, retrying transient errors; returns { data } on success or { status, errText } when it gives up.
async function callModel(model) {
    for (let attempt = 0; ; attempt++) {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                max_tokens: config.maxTokens,
                ...(config.reasoningEffort && { reasoning_effort: config.reasoningEffort }),
            }),
        });

        if (response.ok) return { data: await response.json() };

        const errText = await response.text();
        if (!isTransient(response.status) || attempt >= MAX_RETRIES) return { status: response.status, errText };
        const seconds = waitSeconds(attempt, Number(response.headers.get("retry-after")));
        console.error(`LLM review (${labelFor(model)}): HTTP ${response.status}, retrying ${attempt + 1}/${MAX_RETRIES} in ${seconds}s.`);
        await sleep(seconds * 1000);
    }
}

// Main model first; if it ends on a transient error and a fallback is configured, tries the fallback.
async function callLlm() {
    let last;
    for (const model of modelChain(config.model, config.fallbackModel)) {
        if (last) console.error(`LLM review: ${labelFor(config.model)} failed (HTTP ${last.status}), trying fallback ${labelFor(model)}.`);
        label = labelFor(model);
        last = await callModel(model);
        if (last.data) return last.data;
        if (!isTransient(last.status)) break;
    }
    fail(`HTTP ${last.status}: ${last.errText.substring(0, 500)}`);
}

try {
    const data = await callLlm();
    const choice = data.choices?.[0];
    const reviewText = choice?.message?.content;
    if (!reviewText) fail("empty or malformed response.");

    // Actual tokens consumed: used to tune PR_REVIEW_MAX_CHARS.
    const usage = data.usage;
    if (usage) {
        const reasoning = usage.completion_tokens_details?.reasoning_tokens;
        console.log(`Token: ${usage.prompt_tokens} sent (${prompt.length} characters), ${usage.completion_tokens} response` +
            (reasoning ? ` of which ${reasoning} reasoning` : "") + ".");
    }

    const codeList = (files, max = 10) =>
        files.slice(0, max).map((f) => `\`${f}\``).join(", ") + (files.length > max ? ` ${phrases.andMore(files.length - max)}` : "");
    const notes = [];
    if (selection.docsOnly) notes.push(phrases.docsOnly);
    if (selection.excluded.length) notes.push(phrases.excluded(selection.excluded.length));
    if (selection.omitted.length) notes.push(phrases.omitted(selection.omitted.length, codeList(selection.omitted)));
    if (selection.partial.length) notes.push(phrases.partial(codeList(selection.partial)));
    if (choice.finish_reason === "length") notes.push(phrases.truncated(config.maxTokens));
    const footer = notes.length ? `\n\n> ⚠️ ${phrases.note}: ${notes.join("; ")}.` : "";

    // Post comment
    const finalReviewText = `## 🤖 ${phrases.title} (${label})\n\n${reviewText}${footer}`;
    execFileSync("gh", ["pr", "comment", prNumber, "-F", "-"], { input: finalReviewText, encoding: "utf-8" });
    console.log(`LLM review posted successfully (${label}).`);
} catch (error) {
    fail(`unexpected error: ${error.message}`);
}
