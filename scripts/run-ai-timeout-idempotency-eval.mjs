import assert from "node:assert/strict";
import {
  AIExecutionError,
  executeAIRequest,
  resetAIExecutionStateForTests,
} from "../src/lib/server/ai-execution-control.ts";

resetAIExecutionStateForTests();
let calls = 0;
let release;
const blocked = new Promise((resolve) => {
  release = resolve;
});
const policy = {
  timeoutMs: 5,
  maxConcurrent: 2,
  maxRequestsPerWindow: 10,
  rateWindowMs: 1_000,
  maxEstimatedCost: 10,
  maxRetries: 0,
  retryBackoffMs: 0,
  idempotencyTtlMs: 1_000,
};
let requestId = 0;
const dependencies = {
  now: () => 100,
  createRequestId: () => `timeout-request-${++requestId}`,
};

await assert.rejects(
  executeAIRequest({
    operation: "note",
    input: { text: "same" },
    idempotencyKey: "timeout-idem-0001",
    policy,
    dependencies,
    handler: async () => {
      calls += 1;
      return blocked;
    },
  }),
  (error) => error instanceof AIExecutionError && error.code === "AI_TIMEOUT",
);

await assert.rejects(
  executeAIRequest({
    operation: "note",
    input: { text: "same" },
    idempotencyKey: "timeout-idem-0001",
    policy,
    dependencies,
    handler: async () => {
      calls += 1;
      return { ok: true };
    },
  }),
  (error) => error instanceof AIExecutionError && error.code === "AI_TIMEOUT",
);
assert.equal(
  calls,
  1,
  "A timed-out in-flight idempotent request must not start a second provider call.",
);

release({ ok: true });
await new Promise((resolve) => setTimeout(resolve, 0));
console.log("AI timeout idempotency regression passed.");
