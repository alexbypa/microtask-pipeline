// Tests for review-language.mjs: node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LANGUAGE, parseLanguageArg, phrasesFor } from "./review-language.mjs";

test("parseLanguageArg without --lang uses the default and keeps the arguments", () => {
    assert.deepEqual(parseLanguageArg(["42"]), { language: DEFAULT_LANGUAGE, rest: ["42"] });
});

test("parseLanguageArg extracts --lang in any position", () => {
    assert.deepEqual(parseLanguageArg(["42", "--lang", "Italiano"]), { language: "Italiano", rest: ["42"] });
    assert.deepEqual(parseLanguageArg(["--lang", "Deutsch", "7"]), { language: "Deutsch", rest: ["7"] });
});

test("parseLanguageArg rejects --lang without a value", () => {
    assert.throws(() => parseLanguageArg(["42", "--lang"]));
    assert.throws(() => parseLanguageArg(["--lang", "--check"]));
});

test("phrasesFor recognizes Italian and uses English for other languages", () => {
    for (const lang of ["Italiano", "italian", "it", "it-IT", " Italiana "]) assert.equal(phrasesFor(lang).title, "Revisione automatica");
    for (const lang of ["English", "en", "Deutsch", "Français", "item"]) assert.equal(phrasesFor(lang).title, "Automated review");
});
