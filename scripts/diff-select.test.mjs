// Test di diff-select.mjs: node --test plugins/microtask-pipeline/scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, CODE, CONFIG, TEST, matchesPattern, parseExclude, selectDiff, splitDiff } from "./diff-select.mjs";

const block = (path, body = "+riga\n") =>
    `diff --git a/${path} b/${path}\nindex 111..222 100644\n--- a/${path}\n+++ b/${path}\n@@ -1,1 +1,1 @@\n${body}`;

test("splitDiff legge il path di ogni file, anche tra virgolette", () => {
    const diff = block("src/A.cs") + `diff --git "a/src/con spazio.cs" "b/src/con spazio.cs"\n@@ -1 +1 @@\n+x\n`;
    assert.deepEqual(splitDiff(diff).map((b) => b.path), ["src/A.cs", "src/con spazio.cs"]);
});

test("classify riconosce codice, configurazione e test (anche .NET)", () => {
    assert.equal(classify("src/Dashboard/DashboardOptions.cs"), CODE);
    assert.equal(classify("src/app.js"), CODE);
    assert.equal(classify("src/Lib/Lib.csproj"), CONFIG);
    assert.equal(classify(".github/workflows/ci.yml"), CONFIG);
    assert.equal(classify("tests/Lib.Tests/AuthTests.cs"), TEST);
    assert.equal(classify("src/Lib.Tests/Auth.cs"), TEST);
    assert.equal(classify("src/AuthHandlerTests.cs"), TEST);
    assert.equal(classify("web/auth.spec.ts"), TEST);
    assert.equal(classify("test/fixture.json"), TEST);
});

test("matchesPattern: cartelle, nomi file e path", () => {
    assert.ok(matchesPattern("docs/site/index.html", "docs/"));
    assert.ok(matchesPattern("src/docs/a.txt", "docs/"));
    assert.ok(!matchesPattern("src/Docsy.cs", "docs/"));
    assert.ok(matchesPattern("README.MD", "*.md"));
    assert.ok(matchesPattern("src/Form1.Designer.cs", "*.Designer.cs"));
    assert.ok(!matchesPattern("src/Designer.cs", "*.Designer.cs"));
    assert.ok(matchesPattern("src/gen/a.cs", "src/gen/*.cs"));
});

test("parseExclude aggiunge ai default e toglie con !", () => {
    const list = parseExclude("*.sql, !docs/");
    assert.ok(list.includes("*.sql"));
    assert.ok(list.includes("*.md"));
    assert.ok(!list.includes("docs/"));
});

test("selectDiff: niente documentazione, codice prima dei test", () => {
    const diff = block("CHANGELOG.md") + block("tests/AuthTests.cs") + block("docs/x.html") + block("src/Auth.cs") + block("src/App.csproj");
    const r = selectDiff(diff, { maxChars: 100000 });
    assert.deepEqual(r.excluded, ["CHANGELOG.md", "docs/x.html"]);
    assert.deepEqual(splitDiff(r.text).map((b) => b.path), ["src/Auth.cs", "src/App.csproj", "tests/AuthTests.cs"]);
    assert.deepEqual(r.omitted, []);
});

test("selectDiff: sul limite si perdono i test, mai un file a metà", () => {
    const code = block("src/Auth.cs");
    const diff = block("tests/AuthTests.cs", "+test\n".repeat(50)) + code;
    const r = selectDiff(diff, { maxChars: code.length + 10 });
    assert.equal(r.text, code);
    assert.deepEqual(r.omitted, ["tests/AuthTests.cs"]);
});

test("selectDiff: un file di codice oltre il limite entra a hunk interi", () => {
    const hunk = (n) => `@@ -${n},1 +${n},1 @@\n${"+riga\n".repeat(20)}`;
    const header = `diff --git a/src/Big.cs b/src/Big.cs\n--- a/src/Big.cs\n+++ b/src/Big.cs\n`;
    const text = header + hunk(1) + hunk(50) + hunk(90);
    const r = selectDiff(text, { maxChars: header.length + hunk(1).length + hunk(50).length + 5 });
    assert.deepEqual(r.partial, ["src/Big.cs"]);
    assert.equal(splitDiff(r.text).length, 1);
    assert.equal((r.text.match(/^@@ /gm) || []).length, 2);
});

test("selectDiff: PR di sola documentazione manda la documentazione", () => {
    const r = selectDiff(block("README.md"), { maxChars: 100000 });
    assert.ok(r.docsOnly);
    assert.match(r.text, /README\.md/);
});
