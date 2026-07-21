import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const originalKey = process.env.LOVABLE_API_KEY;

process.env.LOVABLE_API_KEY = "test-key";

try {
  const { runOCRGeneration } = await import("../src/lib/server/ocr-generation.ts");
  const controller = new AbortController();
  let observedSignal;
  let fetchStartedResolve;
  const fetchStarted = new Promise((resolve) => {
    fetchStartedResolve = resolve;
  });

  globalThis.fetch = (_input, init = {}) => {
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

  await fetchStarted;
  assert.equal(observedSignal, controller.signal, "OCR must pass the controlled signal to provider fetch");

  controller.abort();
  await assert.rejects(generation, (error) => error instanceof DOMException && error.name === "AbortError");

  console.log("OCR cancellation runtime evaluation passed.");
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.LOVABLE_API_KEY;
  else process.env.LOVABLE_API_KEY = originalKey;
}
