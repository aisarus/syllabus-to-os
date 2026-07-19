import assert from "node:assert/strict";
import { z } from "zod";
import {
  handleAIJSONRequest,
  resetAIRequestPolicyForTests,
} from "../src/lib/server/ai-route-policy.ts";

const schema = z.object({ text: z.string().max(32) }).strict();
const request = (body, headers = {}) =>
  new Request("https://lamdan.test/api/ai/test", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "127.0.0.1", ...headers },
    body,
  });

resetAIRequestPolicyForTests();
let response = await handleAIJSONRequest(request("{"), {
  operation: "test-invalid-json",
  schema,
  handler: async () => ({ ok: true }),
});
assert.equal(response.status, 400);
assert.equal((await response.json()).code, "INVALID_JSON");

response = await handleAIJSONRequest(request(JSON.stringify({ text: "x".repeat(40) })), {
  operation: "test-schema",
  schema,
  handler: async () => ({ ok: true }),
});
assert.equal(response.status, 422);
assert.equal((await response.json()).code, "INVALID_INPUT");

response = await handleAIJSONRequest(request(JSON.stringify({ text: "123456" })), {
  operation: "test-size",
  schema,
  maxBodyBytes: 4,
  handler: async () => ({ ok: true }),
});
assert.equal(response.status, 413);

resetAIRequestPolicyForTests();
let charges = 0;
const idempotentOptions = {
  operation: "test-idempotency",
  schema,
  costUnits: 2,
  handler: async () => {
    charges += 1;
    return { ok: true, draft: { value: charges } };
  },
};
const headers = { "idempotency-key": "same-request-0001" };
const first = await handleAIJSONRequest(
  request(JSON.stringify({ text: "same" }), headers),
  idempotentOptions,
);
const second = await handleAIJSONRequest(
  request(JSON.stringify({ text: "same" }), headers),
  idempotentOptions,
);
assert.equal(first.status, 200);
assert.equal(second.status, 200);
assert.equal(charges, 1);
assert.equal(second.headers.get("x-idempotency-replayed"), "true");

const conflict = await handleAIJSONRequest(
  request(JSON.stringify({ text: "different" }), headers),
  idempotentOptions,
);
assert.equal(conflict.status, 409);
assert.equal((await conflict.json()).code, "IDEMPOTENCY_CONFLICT");

resetAIRequestPolicyForTests();
response = await handleAIJSONRequest(request(JSON.stringify({ text: "slow" })), {
  operation: "test-timeout",
  schema,
  timeoutMs: 5,
  handler: async (_input, context) =>
    new Promise((resolve) => {
      context.signal.addEventListener("abort", () => resolve({ ok: false, error: "aborted" }), {
        once: true,
      });
    }),
});
assert.equal(response.status, 504);
assert.equal((await response.json()).code, "AI_TIMEOUT");

resetAIRequestPolicyForTests();
for (let index = 0; index < 2; index += 1) {
  response = await handleAIJSONRequest(request(JSON.stringify({ text: String(index) })), {
    operation: "test-budget",
    schema,
    costUnits: 20,
    handler: async () => ({ ok: true }),
  });
  assert.equal(response.status, 200);
}
response = await handleAIJSONRequest(request(JSON.stringify({ text: "third" })), {
  operation: "test-budget",
  schema,
  costUnits: 20,
  handler: async () => ({ ok: true }),
});
assert.equal(response.status, 429);
assert.equal((await response.json()).code, "AI_BUDGET_EXCEEDED");

console.log("AI route validation, timeout, idempotency, rate and cost policy evaluations passed.");
