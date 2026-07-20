import assert from "node:assert/strict";
import { z } from "zod";
import { handleControlledAIJsonRequest } from "../src/lib/server/ai-execution-http.ts";
import { resetAIExecutionStateForTests } from "../src/lib/server/ai-execution-control.ts";

const schema = z.object({ text: z.string().min(1) }).strict();

resetAIExecutionStateForTests();
let calls = 0;
const invalid = await handleControlledAIJsonRequest(
  new Request("http://lamdan.test/api/ai/note", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "request-invalid-001" },
    body: JSON.stringify({ text: 123 }),
  }),
  schema,
  "note",
  async () => {
    calls += 1;
    return { ok: true };
  },
);
assert.equal(invalid.status, 400);
assert.equal(invalid.headers.get("x-request-id"), "request-invalid-001");
assert.equal(calls, 0, "Validation must reject before provider execution.");

const badKey = await handleControlledAIJsonRequest(
  new Request("http://lamdan.test/api/ai/note", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "bad" },
    body: JSON.stringify({ text: "hello" }),
  }),
  schema,
  "note",
  async () => {
    calls += 1;
    return { ok: true };
  },
);
assert.equal(badKey.status, 400);
assert.equal((await badKey.json()).code, "INVALID_IDEMPOTENCY_KEY");
assert.equal(calls, 0);

const requestBody = JSON.stringify({ text: "hello" });
const first = await handleControlledAIJsonRequest(
  new Request("http://lamdan.test/api/ai/note", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "idem-http-0001",
      "x-request-id": "request-first-001",
    },
    body: requestBody,
  }),
  schema,
  "note",
  async () => {
    calls += 1;
    return { ok: true, draft: { title: "Draft" } };
  },
);
assert.equal(first.status, 200);
assert.equal(first.headers.get("x-request-id"), "request-first-001");
assert.equal(first.headers.get("x-idempotent-replay"), null);

const replay = await handleControlledAIJsonRequest(
  new Request("http://lamdan.test/api/ai/note", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "idem-http-0001",
      "x-request-id": "request-replay-002",
    },
    body: requestBody,
  }),
  schema,
  "note",
  async () => {
    calls += 1;
    return { ok: true, draft: { title: "Wrong" } };
  },
);
assert.equal(replay.status, 200);
assert.equal(replay.headers.get("x-request-id"), "request-replay-002");
assert.equal(replay.headers.get("x-idempotent-replay"), "true");
assert.equal(replay.headers.get("x-original-request-id"), "request-first-001");
assert.equal(calls, 1, "Completed replay must not call the provider twice.");
assert.deepEqual(await replay.json(), { ok: true, draft: { title: "Draft" } });

console.log("AI execution HTTP validation, request ID and replay evaluations passed.");
