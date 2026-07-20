import assert from "node:assert/strict";
import {
  aiGenerationInputSchema,
  aiResultResponse,
  handleAIJsonRequest,
  parseAIFormDataRequest,
} from "../src/lib/server/ai-api-contract.ts";

async function json(response) {
  return response.json();
}

let calls = 0;
const malformed = await handleAIJsonRequest(
  new Request("http://lamdan.test/api/ai/generate-note", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{broken",
  }),
  aiGenerationInputSchema,
  async () => {
    calls += 1;
    return { ok: true };
  },
);
assert.equal(malformed.status, 400);
assert.deepEqual(await json(malformed), {
  ok: false,
  code: "INVALID_JSON",
  error: "Invalid JSON body.",
});
assert.equal(calls, 0, "Malformed JSON must fail before provider invocation.");

const wrongShape = await handleAIJsonRequest(
  new Request("http://lamdan.test/api/ai/generate-note", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chunks: "SECRET_SOURCE_PASSAGE" }),
  }),
  aiGenerationInputSchema,
  async () => {
    calls += 1;
    return { ok: true };
  },
);
const wrongShapeBody = await json(wrongShape);
assert.equal(wrongShape.status, 400);
assert.equal(wrongShapeBody.code, "INVALID_INPUT");
assert.match(wrongShapeBody.details, /^chunks:/);
assert.doesNotMatch(JSON.stringify(wrongShapeBody), /SECRET_SOURCE_PASSAGE/);
assert.equal(calls, 0, "Invalid schema input must fail before provider invocation.");

const declaredOversize = await handleAIJsonRequest(
  new Request("http://lamdan.test/api/ai/generate-note", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "2000001" },
    body: "{}",
  }),
  aiGenerationInputSchema,
  async () => {
    calls += 1;
    return { ok: true };
  },
);
assert.equal(declaredOversize.status, 413);
assert.equal((await json(declaredOversize)).code, "PAYLOAD_TOO_LARGE");
assert.equal(calls, 0, "Oversized requests must fail before provider invocation.");

const successPayload = {
  ok: true,
  draft: { title: "Draft" },
  model: "test-model",
  promptVersion: "test-v1",
};
const success = await handleAIJsonRequest(
  new Request("http://lamdan.test/api/ai/generate-note", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locale: "ru", chunks: [{ id: "c1", text: "source" }] }),
  }),
  aiGenerationInputSchema,
  async () => {
    calls += 1;
    return successPayload;
  },
);
assert.equal(success.status, 200);
assert.deepEqual(
  await json(success),
  successPayload,
  "Successful response shape must remain unchanged.",
);
assert.equal(calls, 1);

const thrown = await handleAIJsonRequest(
  new Request("http://lamdan.test/api/ai/generate-note", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }),
  aiGenerationInputSchema,
  async () => {
    throw new Error("sk-SECRET raw source passage\nSTACK TRACE");
  },
);
const thrownBody = await json(thrown);
assert.equal(thrown.status, 500);
assert.equal(thrownBody.code, "INTERNAL_ERROR");
assert.doesNotMatch(JSON.stringify(thrownBody), /SECRET|source passage|STACK/);

const providerFailure = aiResultResponse({
  ok: false,
  error: "Invalid API key sk-SECRET123456 raw source passage",
  details: "Bearer sk-SECRET123456 raw source passage",
});
const providerFailureBody = await json(providerFailure);
assert.equal(providerFailure.status, 502);
assert.equal(providerFailureBody.code, "PROVIDER_ERROR");
assert.doesNotMatch(JSON.stringify(providerFailureBody), /SECRET|Bearer|source passage/);

const unavailable = aiResultResponse({ ok: false, error: "AI is not configured" });
assert.equal(unavailable.status, 503);
assert.equal((await json(unavailable)).code, "PROVIDER_UNAVAILABLE");

const badForm = await parseAIFormDataRequest(
  new Request("http://lamdan.test/api/ai/transcribe-long-media", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not multipart",
  }),
);
assert.equal(badForm.ok, false);
if (!badForm.ok) {
  assert.equal(badForm.response.status, 400);
  assert.equal((await json(badForm.response)).code, "INVALID_FORM_DATA");
}

console.log("AI API malformed-input, oversize, compatibility and redaction evaluations passed.");
