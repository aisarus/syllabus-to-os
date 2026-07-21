import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const originalKey = process.env.LOVABLE_API_KEY;
const TEST_TIMEOUT_MS = 2_000;

process.env.LOVABLE_API_KEY = "test-key";

function withTimeout(promise, message) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), TEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

const requestController = new AbortController();

try {
  const [{ executeAIRequest }, { AIExecutionError }, { runConceptExtractionGeneration }] =
    await Promise.all([
      import("../src/lib/server/ai-execution-runtime.ts"),
      import("../src/lib/server/ai-execution-types.ts"),
      import("../src/lib/server/concept-extraction-generation.ts"),
    ]);

  let observedSignal;
  let fetchCallCount = 0;
  let fetchStartedResolve;
  const fetchStarted = new Promise((resolve) => {
    fetchStartedResolve = resolve;
  });

  globalThis.fetch = (_input, init = {}) => {
    fetchCallCount += 1;
    observedSignal = init.signal;
    fetchStartedResolve();

    return new Promise((_resolve, reject) => {
      if (init.signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      init.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  };

  const input = {
    locale: "en",
    targetLanguage: "en",
    chunks: [{ id: "chunk-1", text: "Judicial review is review by courts." }],
    existingConceptTitles: [],
  };

  const execution = executeAIRequest({
    operation: "concept-extraction",
    input,
    signal: requestController.signal,
    policy: { maxRetries: 0, timeoutMs: 10_000 },
    dependencies: { createRequestId: () => "concept-extraction-cancellation-eval" },
    handler: () => runConceptExtractionGeneration(input),
  });

  await withTimeout(fetchStarted, "Concept extraction did not reach provider fetch before the runtime deadline");
  assert.equal(fetchCallCount, 1, "Concept extraction must issue exactly one provider request");
  assert.ok(observedSignal instanceof AbortSignal, "Provider fetch must receive an AbortSignal");
  assert.equal(observedSignal.aborted, false, "Provider signal must start active");

  requestController.abort();

  await assert.rejects(
    withTimeout(execution, "Concept extraction execution did not reject after cancellation"),
    (error) => error instanceof AIExecutionError && error.code === "AI_CANCELLED",
  );
  assert.equal(observedSignal.aborted, true, "Provider signal must abort with the controlled request");

  console.log("Concept extraction cancellation runtime evaluation passed.");
} finally {
  requestController.abort();
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.LOVABLE_API_KEY;
  else process.env.LOVABLE_API_KEY = originalKey;
}
