// Test di review-language.mjs: node --test plugins/microtask-pipeline/scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LANGUAGE, parseLanguageArg, phrasesFor } from "./review-language.mjs";

test("parseLanguageArg senza --lang usa il default e lascia gli argomenti", () => {
    assert.deepEqual(parseLanguageArg(["42"]), { language: DEFAULT_LANGUAGE, rest: ["42"] });
});

test("parseLanguageArg estrae --lang in qualunque posizione", () => {
    assert.deepEqual(parseLanguageArg(["42", "--lang", "Italiano"]), { language: "Italiano", rest: ["42"] });
    assert.deepEqual(parseLanguageArg(["--lang", "Deutsch", "7"]), { language: "Deutsch", rest: ["7"] });
});

test("parseLanguageArg rifiuta --lang senza valore", () => {
    assert.throws(() => parseLanguageArg(["42", "--lang"]));
    assert.throws(() => parseLanguageArg(["--lang", "--check"]));
});

test("phrasesFor riconosce l'italiano e usa l'inglese per le altre lingue", () => {
    for (const lang of ["Italiano", "italian", "it", "it-IT", " Italiana "]) assert.equal(phrasesFor(lang).title, "Revisione automatica");
    for (const lang of ["English", "en", "Deutsch", "Français", "item"]) assert.equal(phrasesFor(lang).title, "Automated review");
});
