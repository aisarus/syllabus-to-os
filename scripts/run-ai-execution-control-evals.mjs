import assert from "node:assert/strict";
import {
  AIExecutionError,
  executeAIRequest,
  resetAIExecutionStateForTests,
} from "../src/lib/server/ai-execution-control.ts";

const basePolicy = {
  timeoutMs: 100,
  maxConcurrent: 2,
  maxRequestsPerWindow: 10,
  rateWindowMs: 1_000,
  maxEstimatedCost: 10,
  maxRetries: 1,
  retryBackoffMs: 0,
  idempotencyTtlMs: 1_000,
};

let id = 0;
const dependencies = {
  now: () => 100,
  sleep: async () => {},
  createRequestId: () => `request-${++id}`,
};

resetAIExecutionStateForTests();
let providerCalls = 0;
let release;
const held = new Promise((resolve) => {
  release = resolve;
});
const first = executeAIRequest({
  operation: "note",
  input: { text: "same" },
  idempotencyKey: "idem-key-0001",
  policy: basePolicy,
  dependencies,
  handler: async () => {
    providerCalls += 1;
    await held;
    return { ok: true, draft: "one" };
  },
});
const duplicate = executeAIRequest({
  operation: "note",
  input: { text: "same" },
  idempotencyKey: "idem-key-0001",
  policy: basePolicy,
  dependencies,
  handler: async () => {
    providerCalls += 1;
    return { ok: true, draft: "duplicate" };
  },
});
release();
const [firstResult, duplicateResult] = await Promise.all([first, duplicate]);
assert.equal(providerCalls, 1, "Concurrent duplicate requests must invoke the provider once.");
assert.equal(firstResult.replayed, false);
assert.equal(duplicateResult.replayed, true);
assert.equal(duplicateResult.originalRequestId, firstResult.requestId);
assert.notEqual(duplicateResult.requestId, firstResult.requestId);

const completedReplay = await executeAIRequest({
  operation: "note",
  input: { text: "same" },
  idempotencyKey: "idem-key-0001",
  policy: basePolicy,
  dependencies,
  handler: async () => {
    providerCalls += 1;
    return { ok: true, draft: "late" };
  },
});
assert.equal(providerCalls, 1, "Completed replay must not invoke the provider twice.");
assert.equal(completedReplay.replayed, true);

await assert.rejects(
  executeAIRequest({
    operation: "note",
    input: { text: "different" },
    idempotencyKey: "idem-key-0001",
    policy: basePolicy,
    dependencies,
    handler: async () => ({ ok: true }),
  }),
  (error) => error instanceof AIExecutionError && error.code === "IDEMPOTENCY_CONFLICT",
);

resetAIExecutionStateForTests();
let retryCalls = 0;
const retryResult = await executeAIRequest({
  operation: "quiz",
  input: { text: "retry" },
  policy: basePolicy,
  dependencies: { ...dependencies, isTransientError: () => true },
  handler: async ({ attempt }) => {
    retryCalls += 1;
    if (attempt === 0) throw Object.assign(new Error("temporary"), { status: 503 });
    return { ok: true };
  },
});
assert.deepEqual(retryResult.value, { ok: true });
assert.equal(retryCalls, 2);

resetAIExecutionStateForTests();
let transientResultCalls = 0;
const transientResult = await executeAIRequest({
  operation: "note",
  input: { text: "transient-result" },
  policy: basePolicy,
  dependencies,
  handler: async ({ attempt }) => {
    transientResultCalls += 1;
    return attempt === 0
      ? { ok: false, error: "Provider temporarily overloaded (503)" }
      : { ok: true, draft: "recovered" };
  },
});
assert.deepEqual(transientResult.value, { ok: true, draft: "recovered" });
assert.equal(transientResultCalls, 2, "Transient provider results must be retried.");

resetAIExecutionStateForTests();
let nonTransientResultCalls = 0;
const nonTransientResult = await executeAIRequest({
  operation: "note",
  input: { text: "invalid-result" },
  policy: basePolicy,
  dependencies,
  handler: async () => {
    nonTransientResultCalls += 1;
    return { ok: false, error: "invalid input" };
  },
});
assert.equal(nonTransientResult.value.ok, false);
assert.equal(nonTransientResultCalls, 1, "Non-transient provider results must not be retried.");

resetAIExecutionStateForTests();
let permanentCalls = 0;
await assert.rejects(
  executeAIRequest({
    operation: "quiz",
    input: { text: "permanent" },
    policy: basePolicy,
    dependencies: { ...dependencies, isTransientError: () => false },
    handler: async () => {
      permanentCalls += 1;
      throw new Error("permanent");
    },
  }),
);
assert.equal(permanentCalls, 1, "Non-transient errors must not be retried.");

resetAIExecutionStateForTests();
await assert.rejects(
  executeAIRequest({
    operation: "ocr",
    input: { huge: "x" },
    estimatedCost: 11,
    policy: basePolicy,
    dependencies,
    handler: async () => {
      throw new Error("provider must not run");
    },
  }),
  (error) => error instanceof AIExecutionError && error.code === "AI_COST_LIMIT",
);

resetAIExecutionStateForTests();
let releaseTimedOut;
const blocked = new Promise((resolve) => {
  releaseTimedOut = resolve;
});
await assert.rejects(
  executeAIRequest({
    operation: "syllabus",
    input: { text: "timeout" },
    policy: { ...basePolicy, timeoutMs: 5, maxConcurrent: 1 },
    dependencies,
    handler: async () => blocked,
  }),
  (error) => error instanceof AIExecutionError && error.code === "AI_TIMEOUT",
);
await assert.rejects(
  executeAIRequest({
    operation: "syllabus",
    input: { text: "still-running" },
    policy: { ...basePolicy, maxConcurrent: 1 },
    dependencies,
    handler: async () => ({ ok: true }),
  }),
  (error) => error instanceof AIExecutionError && error.code === "AI_CONCURRENCY_LIMIT",
);
releaseTimedOut({ ok: true });
await new Promise((resolve) => setTimeout(resolve, 0));
await executeAIRequest({
  operation: "syllabus",
  input: { text: "after-settle" },
  policy: { ...basePolicy, maxConcurrent: 1 },
  dependencies,
  handler: async () => ({ ok: true }),
});

resetAIExecutionStateForTests();
let holdConcurrency;
const concurrencyGate = new Promise((resolve) => {
  holdConcurrency = resolve;
});
const active = executeAIRequest({
  operation: "transcription",
  input: { file: "one" },
  policy: { ...basePolicy, maxConcurrent: 1 },
  dependencies,
  handler: async () => {
    await concurrencyGate;
    return { ok: true };
  },
});
await assert.rejects(
  executeAIRequest({
    operation: "transcription",
    input: { file: "two" },
    policy: { ...basePolicy, maxConcurrent: 1 },
    dependencies,
    handler: async () => ({ ok: true }),
  }),
  (error) => error instanceof AIExecutionError && error.code === "AI_CONCURRENCY_LIMIT",
);
holdConcurrency();
await active;

resetAIExecutionStateForTests();
const ratePolicy = { ...basePolicy, maxRequestsPerWindow: 1 };
await executeAIRequest({
  operation: "translate",
  input: { text: "one" },
  policy: ratePolicy,
  dependencies,
  handler: async () => ({ ok: true }),
});
await assert.rejects(
  executeAIRequest({
    operation: "translate",
    input: { text: "two" },
    policy: ratePolicy,
    dependencies,
    handler: async () => ({ ok: true }),
  }),
  (error) => error instanceof AIExecutionError && error.code === "AI_RATE_LIMIT",
);

console.log(
  "AI execution timeout, concurrency, rate, cost, retry and idempotency evaluations passed.",
);
