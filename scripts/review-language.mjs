// plugins/microtask-pipeline/scripts/review-language.mjs
// Lingua della review LLM: argomento --lang e frasi fisse del commento (italiano o inglese, fallback inglese).

export const DEFAULT_LANGUAGE = "English";

// Estrae --lang <lingua> dagli argomenti; restituisce la lingua e gli argomenti rimanenti.
export function parseLanguageArg(args) {
    const index = args.indexOf("--lang");
    if (index === -1) return { language: DEFAULT_LANGUAGE, rest: args };
    const value = args[index + 1]?.trim();
    if (!value || value.startsWith("--")) throw new Error("--lang richiede una lingua (es. --lang Italiano).");
    return { language: value, rest: args.filter((_, i) => i !== index && i !== index + 1) };
}

const PHRASES = {
    it: {
        title: "Revisione automatica",
        note: "Nota",
        andMore: (n) => `e altri ${n}`,
        docsOnly: "PR di sola documentazione, rivista quella",
        excluded: (n) => `esclusi ${n} file di documentazione o generati`,
        omitted: (n, list) => `omessi per lunghezza ${n} file: ${list}`,
        partial: (list) => `inclusi solo in parte: ${list}`,
        truncated: (tokens) => `risposta tagliata a ${tokens} token`,
    },
    en: {
        title: "Automated review",
        note: "Note",
        andMore: (n) => `and ${n} more`,
        docsOnly: "documentation-only PR, reviewed as such",
        excluded: (n) => `excluded ${n} documentation or generated files`,
        omitted: (n, list) => `omitted for length ${n} files: ${list}`,
        partial: (list) => `only partially included: ${list}`,
        truncated: (tokens) => `response cut at ${tokens} tokens`,
    },
};

// Frasi fisse per la lingua richiesta: italiano ("Italiano", "Italian", "it", "it-IT"), altrimenti inglese.
export function phrasesFor(language) {
    return /^it(alian[oa]?|-[a-z]{2})?$/i.test(language.trim()) ? PHRASES.it : PHRASES.en;
}
