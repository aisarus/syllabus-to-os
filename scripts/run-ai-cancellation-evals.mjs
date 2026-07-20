import assert from "node:assert/strict";
import {
  AIExecutionError,
  executeAIRequest,
  resetAIExecutionStateForTests,
} from "../src/lib/server/ai-execution-control.ts";
import { generateGeminiJSON } from "../src/lib/server/gemini.ts";

const policy = {
  timeoutMs: 50,
  maxConcurrent: 2,
  maxRequestsPerWindow: 20,
  rateWindowMs: 1_000,
  maxEstimatedCost: 10,
  maxRetries: 2,
  retryBackoffMs: 0,
  idempotencyTtlMs: 1_000,
};
let requestId = 0;
const dependencies = {
  now: () => 100,
  sleep: async () => {},
  createRequestId: () => `cancel-request-${++requestId}`,
};

resetAIExecutionStateForTests();
const preAborted = new AbortController();
preAborted.abort();
let preAbortCalls = 0;
await assert.rejects(
  executeAIRequest({
    operation: "note",
    input: { text: "cancelled" },
    signal: preAborted.signal,
    policy,
    dependencies,
    handler: async () => {
      preAbortCalls += 1;
      return { ok: true };
    },
  }),
  (error) => error instanceof AIExecutionError && error.code === "AI_CANCELLED",
);
assert.equal(preAbortCalls, 0, "An already-aborted request must not invoke the provider.");

resetAIExecutionStateForTests();
const during = new AbortController();
let duringCalls = 0;
let providerObservedAbort = false;
const duringPromise = executeAIRequest({
  operation: "quiz",
  input: { text: "during" },
  signal: during.signal,
  policy,
  dependencies,
  handler: async ({ signal }) => {
    duringCalls += 1;
    return new Promise((_, reject) => {
      signal.addEventListener(
        "abort",
        () => {
          providerObservedAbort = true;
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  },
});
during.abort();
await assert.rejects(
  duringPromise,
  (error) => error instanceof AIExecutionError && error.code === "AI_CANCELLED",
);
assert.equal(duringCalls, 1);
assert.equal(providerObservedAbort, true, "Provider handler must observe client cancellation.");

resetAIExecutionStateForTests();
let timeoutObservedAbort = false;
await assert.rejects(
  executeAIRequest({
    operation: "syllabus",
    input: { text: "timeout" },
    policy: { ...policy, timeoutMs: 5, maxRetries: 0 },
    dependencies,
    handler: async ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            timeoutObservedAbort = true;
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      }),
  }),
  (error) => error instanceof AIExecutionError && error.code === "AI_TIMEOUT",
);
assert.equal(timeoutObservedAbort, true, "Timeout must actively abort provider work.");

resetAIExecutionStateForTests();
let lateCalls = 0;
let releaseLate;
const lateProvider = new Promise((resolve) => {
  releaseLate = resolve;
});
await assert.rejects(
  executeAIRequest({
    operation: "note",
    input: { text: "late" },
    idempotencyKey: "cancel-late-0001",
    policy: { ...policy, timeoutMs: 5, maxRetries: 0 },
    dependencies,
    handler: async () => {
      lateCalls += 1;
      return lateProvider;
    },
  }),
  (error) => error instanceof AIExecutionError && error.code === "AI_TIMEOUT",
);
releaseLate({ ok: true, draft: "stale" });
await new Promise((resolve) => setTimeout(resolve, 0));
const fresh = await executeAIRequest({
  operation: "note",
  input: { text: "late" },
  idempotencyKey: "cancel-late-0001",
  policy: { ...policy, timeoutMs: 50, maxRetries: 0 },
  dependencies,
  handler: async () => {
    lateCalls += 1;
    return { ok: true, draft: "fresh" };
  },
});
assert.equal(lateCalls, 2, "A late result after timeout must not enter the idempotency cache.");
assert.deepEqual(fresh.value, { ok: true, draft: "fresh" });
assert.equal(fresh.replayed, false);

const oldKey = process.env.LOVABLE_API_KEY;
const oldFetch = globalThis.fetch;
process.env.LOVABLE_API_KEY = "test-key";
try {
  let gatewaySignal;
  globalThis.fetch = async (_url, init) => {
    gatewaySignal = init?.signal;
    return new Promise((_, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  };
  const gatewayAbort = new AbortController();
  const gatewayPromise = generateGeminiJSON("prompt", "schema", {
    signal: gatewayAbort.signal,
  });
  gatewayAbort.abort();
  await assert.rejects(
    gatewayPromise,
    (error) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(
    gatewaySignal,
    gatewayAbort.signal,
    "Gateway fetch must receive the composed signal.",
  );
} finally {
  globalThis.fetch = oldFetch;
  if (oldKey === undefined) delete process.env.LOVABLE_API_KEY;
  else process.env.LOVABLE_API_KEY = oldKey;
}

console.log("AI cancellation propagation and late-result rejection evaluations passed.");
