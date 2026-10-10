// plugins/microtask-pipeline/scripts/retry-policy.mjs
// Which LLM HTTP errors are worth retrying and how long to wait. Pure functions (no I/O):
// tested by retry-policy.test.mjs with `node --test`.

export const MAX_WAIT_SECONDS = 60;

// 429 = rate limit; 500/502/503/504 = provider overloaded or briefly down (e.g. Gemini "high demand").
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

export function isTransient(status) {
    return TRANSIENT.has(status);
}

// Seconds to wait before retry number `attempt` (0-based): the server's Retry-After if present,
// otherwise 10s, 20s, 30s... capped at MAX_WAIT_SECONDS.
export function waitSeconds(attempt, retryAfter) {
    const base = retryAfter > 0 ? retryAfter : 10 * (attempt + 1);
    return Math.min(base, MAX_WAIT_SECONDS);
}

// Models to try in order: the main one, then the fallback if set and different.
export function modelChain(model, fallbackModel) {
    return fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];
}
