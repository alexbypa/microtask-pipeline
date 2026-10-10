// Tests for retry-policy.mjs: node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_WAIT_SECONDS, isTransient, modelChain, waitSeconds } from "./retry-policy.mjs";

test("isTransient retries rate limits and provider overload, not client errors", () => {
    for (const status of [429, 500, 502, 503, 504]) assert.equal(isTransient(status), true, String(status));
    for (const status of [400, 401, 403, 404]) assert.equal(isTransient(status), false, String(status));
});

test("waitSeconds uses Retry-After when present, otherwise grows by 10s per attempt", () => {
    assert.equal(waitSeconds(0, 7), 7);
    assert.equal(waitSeconds(0, NaN), 10);
    assert.equal(waitSeconds(1, 0), 20);
});

test("waitSeconds never exceeds the cap", () => {
    assert.equal(waitSeconds(0, 600), MAX_WAIT_SECONDS);
    assert.equal(waitSeconds(9, NaN), MAX_WAIT_SECONDS);
});

test("modelChain adds the fallback only when set and different", () => {
    assert.deepEqual(modelChain("a", undefined), ["a"]);
    assert.deepEqual(modelChain("a", "a"), ["a"]);
    assert.deepEqual(modelChain("a", "b"), ["a", "b"]);
});
