// plugins/microtask-pipeline/scripts/pr-review.mjs
// Review automatica di una PR con qualunque LLM compatibile OpenAI (chat completions).
// Uso: node pr-review.mjs <numero PR> [--lang <lingua>]   |   node pr-review.mjs --check
// --lang: lingua della review (default English); la skill passa la lingua della PR.
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { parseExclude, selectDiff } from "./diff-select.mjs";
import { parseLanguageArg, phrasesFor } from "./review-language.mjs";

// Carica .env della cartella corrente (senza dipendenze). Le variabili già impostate vincono.
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

// Intero positivo dall'ambiente; se manca o è vuoto usa il default, se non è valido avvisa su stdout.
function positiveIntEnv(name, fallback) {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;
    if (/^\d+$/.test(raw) && Number(raw) > 0) return Number(raw);
    console.log(`Avviso: ${name}="${raw}" non è un intero positivo, uso il default ${fallback}.`);
    return fallback;
}

const config = {
    apiKey: process.env.PR_REVIEW_API_KEY,
    baseUrl: (process.env.PR_REVIEW_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
    model: process.env.PR_REVIEW_MODEL || "openai/gpt-oss-120b",
    // Default pensati per il piano gratuito di Groq (8K token al minuto su openai/gpt-oss-120b).
    maxChars: Number(process.env.PR_REVIEW_MAX_CHARS) || 16000,
    // Limite di token della risposta (max_tokens): 2048 troncava le review a metà frase.
    maxTokens: positiveIntEnv("PR_REVIEW_MAX_TOKENS", 4096),
    // Facoltativo: non tutti i provider compatibili OpenAI accettano reasoning_effort.
    reasoningEffort: process.env.PR_REVIEW_REASONING_EFFORT?.trim() || undefined,
    exclude: parseExclude(process.env.PR_REVIEW_EXCLUDE),
};
const label = `${config.model} @ ${new URL(config.baseUrl).host}`;

let language, args;
try {
    ({ language, rest: args } = parseLanguageArg(process.argv.slice(2)));
} catch (error) {
    console.error(`Errore: ${error.message}`);
    process.exit(1);
}
const phrases = phrasesFor(language);

if (args[0] === "--check") {
    // Usato dallo SKILL all'avvio: dice se la review è configurata, senza mai stampare la chiave.
    if (config.apiKey) {
        console.log(`Review LLM configurata: ${label} (max ${config.maxTokens} token)`);
        process.exit(0);
    }
    console.log("Review LLM non configurata: PR_REVIEW_API_KEY mancante (ambiente o .env).");
    process.exit(2);
}

const prNumber = args[0];
// Prevenzione Command Injection e validazione argomenti
if (!prNumber || !/^\d+$/.test(prNumber)) {
    console.error("Errore: fornire un numero di PR valido (solo cifre).");
    process.exit(1);
}

function fail(message) {
    console.error(`Review LLM fallita (${label}): ${message}`);
    process.exit(1);
}

if (!config.apiKey) fail("PR_REVIEW_API_KEY mancante (ambiente o .env).");

let diff;
try {
    // execFileSync con array protegge dall'iniezione
    diff = execFileSync("gh", ["pr", "diff", prNumber], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
    fail(`gh pr diff: ${error.message}`);
}

// Codice prima, test in fondo, documentazione fuori; taglio a confine di file (limite di token del provider)
const selection = selectDiff(diff, { maxChars: config.maxChars, exclude: config.exclude });

const listFiles = (files, max = 30) =>
    files.slice(0, max).map((f) => `- ${f}`).join("\n") + (files.length > max ? `\n- ... e altri ${files.length - max}` : "");

const missing = [];
if (selection.excluded.length) missing.push(`File esclusi (documentazione o generati):\n${listFiles(selection.excluded)}`);
if (selection.omitted.length) missing.push(`File omessi per limite di lunghezza:\n${listFiles(selection.omitted)}`);
if (selection.partial.length) missing.push(`File inclusi solo in parte (blocchi @@ interi):\n${listFiles(selection.partial)}`);
const missingSection = missing.length
    ? `\nIl diff può essere incompleto: non segnalare come problema codice che appare troncato o file che non vedi.\n\n${missing.join("\n\n")}\n`
    : "";

const prompt = `Sei un esperto revisore di codice. Analizza il seguente git diff e scrivi una Code Review in questa lingua: ${language} (titoli delle sezioni inclusi), indipendentemente dalla lingua del diff, del progetto e di questo prompt.
Rispetta esattamente questa struttura:

1. **Spiegazione:** Spiegazione elementare (a prova di principiante) di cosa fa la fix o la feature.
2. **Rischi e Problemi:** Evidenziazione di eventuali problemi, rischi o edge cases.
3. **Correzioni suggerite:** Eventuale codice di correzione formattato in Markdown, se necessario (altrimenti indica che non ci sono correzioni).
${missingSection}
Ecco il diff:
\`\`\`diff
${selection.text}
\`\`\`
`;

const MAX_RETRIES = 2;
const MAX_WAIT_SECONDS = 60;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callLlm() {
    for (let attempt = 0; ; attempt++) {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: "user", content: prompt }],
                max_tokens: config.maxTokens,
                ...(config.reasoningEffort && { reasoning_effort: config.reasoningEffort }),
            }),
        });

        if (response.ok) return response.json();

        const errText = await response.text();
        if (response.status === 429 && attempt < MAX_RETRIES) {
            const retryAfter = Number(response.headers.get("retry-after"));
            const waitSeconds = Math.min(retryAfter > 0 ? retryAfter : 10 * (attempt + 1), MAX_WAIT_SECONDS);
            console.error(`Review LLM (${label}): HTTP 429, nuovo tentativo ${attempt + 1}/${MAX_RETRIES} tra ${waitSeconds}s.`);
            await sleep(waitSeconds * 1000);
            continue;
        }
        fail(`HTTP ${response.status}: ${errText.substring(0, 500)}`);
    }
}

try {
    const data = await callLlm();
    const choice = data.choices?.[0];
    const reviewText = choice?.message?.content;
    if (!reviewText) fail("risposta vuota o malformata.");

    // Token reali consumati: servono a tarare PR_REVIEW_MAX_CHARS.
    const usage = data.usage;
    if (usage) {
        const reasoning = usage.completion_tokens_details?.reasoning_tokens;
        console.log(`Token: ${usage.prompt_tokens} inviati (${prompt.length} caratteri), ${usage.completion_tokens} risposta` +
            (reasoning ? ` di cui ${reasoning} di ragionamento` : "") + ".");
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

    // Pubblica commento
    const finalReviewText = `## 🤖 ${phrases.title} (${label})\n\n${reviewText}${footer}`;
    execFileSync("gh", ["pr", "comment", prNumber, "-F", "-"], { input: finalReviewText, encoding: "utf-8" });
    console.log(`Review LLM pubblicata con successo (${label}).`);
} catch (error) {
    fail(`errore imprevisto: ${error.message}`);
}
