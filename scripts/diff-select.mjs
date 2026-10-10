// plugins/microtask-pipeline/scripts/diff-select.mjs
// Chooses which parts of the diff to send to the LLM: drops documentation and generated files,
// puts production code before configuration and tests, cuts at file boundaries.
// Pure functions (no I/O): tested by diff-select.test.mjs with `node --test`.

export const DEFAULT_EXCLUDE = [
    "*.md", "llms.txt", "docs/", "outcomes/",
    "package-lock.json", "packages.lock.json", "pnpm-lock.yaml", "*.lock",
    "*.min.js", "*.min.css", "*.Designer.cs", "*.g.cs",
];

// Categories in priority order: code goes in first, tests only if there is room left.
export const CODE = 0, CONFIG = 1, TEST = 2;

const TEST_PATTERNS = [
    /(^|\/)(tests?|__tests__)\//i,      // tests/, test/, __tests__/
    /\.Tests?(\/|$)/,                   // MyLib.Tests/ (.NET test projects)
    /(^|\/)[^/]*Tests?\.cs$/,           // FooTests.cs, FooTest.cs
    /\.(test|spec)\.[^/]+$/i,           // foo.test.js, foo.spec.ts
];
const CONFIG_PATTERN = /(\.(json|csproj|fsproj|vbproj|props|targets|sln|slnx|ya?ml|xml|config|toml|ini)|(^|\/)(Dockerfile|\.editorconfig|\.gitignore|\.gitattributes))$/i;

// Splits the output of `gh pr diff` into one block per file. Each block starts with `diff --git`.
export function splitDiff(diff) {
    const starts = [...diff.matchAll(/^diff --git /gm)].map((m) => m.index);
    return starts.map((start, i) => {
        const text = diff.slice(start, starts[i + 1] ?? diff.length);
        return { path: blockPath(text), text };
    });
}

function blockPath(text) {
    const newline = text.indexOf("\n");
    const header = newline === -1 ? text : text.slice(0, newline);
    // Paths with special characters: git puts them in quotes ("a/x y" "b/x y").
    const quoted = /"b\/(.*)"$/.exec(header);
    if (quoted) return quoted[1];
    const plain = / b\/(.+)$/.exec(header);
    return plain ? plain[1] : header;
}

// Pattern: `dir/` = folder at any depth; with `/` = full path; otherwise file name.
// `*` matches any text without `/`. Case-insensitive.
function globToRegex(glob) {
    const body = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
    return new RegExp(`^${body}$`, "i");
}

export function matchesPattern(path, pattern) {
    if (pattern.endsWith("/")) {
        const dir = pattern.slice(0, -1).toLowerCase();
        const p = path.toLowerCase();
        return p.startsWith(`${dir}/`) || p.includes(`/${dir}/`);
    }
    const target = pattern.includes("/") ? path : path.split("/").pop();
    return globToRegex(pattern).test(target);
}

// PR_REVIEW_EXCLUDE: comma-separated patterns, added to the defaults; `!pattern` removes a default.
export function parseExclude(value) {
    const patterns = new Set(DEFAULT_EXCLUDE);
    for (const raw of (value || "").split(",")) {
        const item = raw.trim();
        if (!item) continue;
        if (item.startsWith("!")) patterns.delete(item.slice(1).trim());
        else patterns.add(item);
    }
    return [...patterns];
}

export function classify(path) {
    if (TEST_PATTERNS.some((re) => re.test(path))) return TEST;
    if (CONFIG_PATTERN.test(path)) return CONFIG;
    return CODE;
}

// Keeps the file header and the whole hunks (`@@ ... @@`) that fit in `budget` characters.
function cutAtHunks(text, budget) {
    const hunkStarts = [...text.matchAll(/^@@ /gm)].map((m) => m.index);
    if (hunkStarts.length === 0) return null;
    let end = hunkStarts[0];
    for (let i = 0; i < hunkStarts.length; i++) {
        const next = hunkStarts[i + 1] ?? text.length;
        if (next > budget) break;
        end = next;
    }
    return end > hunkStarts[0] ? text.slice(0, end) : null;
}

// Returns the diff to send and the lists of excluded, omitted and partial files.
export function selectDiff(diff, { maxChars, exclude = DEFAULT_EXCLUDE }) {
    const blocks = splitDiff(diff);
    const excluded = [];
    let kept = [];
    for (const block of blocks) {
        if (exclude.some((p) => matchesPattern(block.path, p))) excluded.push(block.path);
        else kept.push(block);
    }

    // Documentation-only PR: better to review the documentation than to review nothing.
    let docsOnly = false;
    if (kept.length === 0 && excluded.length > 0) {
        kept = blocks;
        excluded.length = 0;
        docsOnly = true;
    }

    // stable sort: within the same category git's order is kept.
    kept = kept.map((b) => ({ ...b, category: classify(b.path) })).sort((a, b) => a.category - b.category);

    const parts = [], omitted = [], partial = [];
    let used = 0;
    for (const block of kept) {
        const room = maxChars - used;
        if (block.text.length <= room) {
            parts.push(block.text);
            used += block.text.length;
            continue;
        }
        // Production code that is too long goes in piecewise (whole hunks); config and tests do not.
        const cut = block.category === CODE ? cutAtHunks(block.text, room) : null;
        if (cut) {
            parts.push(cut);
            used += cut.length;
            partial.push(block.path);
        } else {
            omitted.push(block.path);
        }
    }

    // Diff that cannot be split (e.g. unexpected format): old behavior, cut by characters.
    if (blocks.length === 0) {
        const text = diff.length > maxChars ? diff.slice(0, maxChars) : diff;
        return { text, excluded, omitted, partial: diff.length > maxChars ? ["(unrecognized diff)"] : [], docsOnly };
    }

    return { text: parts.join(""), excluded, omitted, partial, docsOnly };
}
