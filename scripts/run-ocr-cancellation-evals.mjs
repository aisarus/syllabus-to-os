import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const originalKey = process.env.LOVABLE_API_KEY;
const TEST_TIMEOUT_MS = 2_000;

process.env.LOVABLE_API_KEY = "test-key";

const withTimeout = (promise, message) => {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), TEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
};

const controller = new AbortController();

try {
  const { runOCRGeneration } = await import("../src/lib/server/ocr-generation.ts");
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

  const generation = runOCRGeneration(
    {
      imageDataUrl: "data:image/png;base64,AA==",
      sourceStyle: "printed",
      locale: "en",
    },
    { signal: controller.signal },
  );

  await withTimeout(fetchStarted, "OCR did not reach provider fetch before the runtime deadline");
  assert.equal(fetchCallCount, 1, "OCR cancellation evaluation must issue exactly one provider request");
  assert.equal(observedSignal, controller.signal, "OCR must pass the controlled signal to provider fetch");

  controller.abort();
  await assert.rejects(
    withTimeout(generation, "OCR provider request did not reject after cancellation"),
    (error) => error instanceof DOMException && error.name === "AbortError",
  );

  console.log("OCR cancellation runtime evaluation passed.");
} finally {
  controller.abort();
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.LOVABLE_API_KEY;
  else process.env.LOVABLE_API_KEY = originalKey;
}
