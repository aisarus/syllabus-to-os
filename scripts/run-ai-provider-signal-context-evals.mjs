import assert from "node:assert/strict";
import {
  AIExecutionError,
  executeAIRequest,
  resetAIExecutionStateForTests,
} from "../src/lib/server/ai-execution-control.ts";
import { generateGeminiJSON } from "../src/lib/server/gemini.ts";
import { transcribeWithConfiguredProvider } from "../src/lib/server/automatic-transcription-provider.ts";

const oldFetch = globalThis.fetch;
const oldLovableKey = process.env.LOVABLE_API_KEY;
const oldOpenAIKey = process.env.OPENAI_API_KEY;
process.env.LOVABLE_API_KEY = "test-lovable";
process.env.OPENAI_API_KEY = "test-openai";

try {
  resetAIExecutionStateForTests();
  let geminiSignal;
  globalThis.fetch = async (_url, init) => {
    geminiSignal = init?.signal;
    return new Promise((_, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  };
  await assert.rejects(
    executeAIRequest({
      operation: "note",
      input: { text: "ambient" },
      policy: {
        timeoutMs: 5,
        maxConcurrent: 1,
        maxRequestsPerWindow: 5,
        rateWindowMs: 1_000,
        maxEstimatedCost: 10,
        maxRetries: 0,
        retryBackoffMs: 0,
        idempotencyTtlMs: 1_000,
      },
      handler: async () => generateGeminiJSON("prompt", "schema"),
    }),
    (error) => error instanceof AIExecutionError && error.code === "AI_TIMEOUT",
  );
  assert.equal(geminiSignal?.aborted, true, "Gemini must receive the execution-scoped signal.");

  resetAIExecutionStateForTests();
  let transcriptionSignal;
  globalThis.fetch = async (_url, init) => {
    transcriptionSignal = init?.signal;
    return new Promise((_, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  };
  const unrelatedRawSignal = new AbortController().signal;
  await assert.rejects(
    executeAIRequest({
      operation: "transcription",
      input: { file: "ambient" },
      policy: {
        timeoutMs: 5,
        maxConcurrent: 1,
        maxRequestsPerWindow: 5,
        rateWindowMs: 1_000,
        maxEstimatedCost: 300,
        maxRetries: 0,
        retryBackoffMs: 0,
        idempotencyTtlMs: 1_000,
      },
      handler: async () =>
        transcribeWithConfiguredProvider({
          file: new File(["audio"], "lecture.mp3", { type: "audio/mpeg" }),
          requestSpeakerLabels: false,
          signal: unrelatedRawSignal,
        }),
    }),
    (error) => error instanceof AIExecutionError && error.code === "AI_TIMEOUT",
  );
  assert.notEqual(
    transcriptionSignal,
    unrelatedRawSignal,
    "Transcription must prefer the composed execution signal.",
  );
  assert.equal(
    transcriptionSignal?.aborted,
    true,
    "Transcription fetch must observe timeout cancellation.",
  );
} finally {
  globalThis.fetch = oldFetch;
  if (oldLovableKey === undefined) delete process.env.LOVABLE_API_KEY;
  else process.env.LOVABLE_API_KEY = oldLovableKey;
  if (oldOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = oldOpenAIKey;
}

console.log("AI provider signal context evaluations passed.");
