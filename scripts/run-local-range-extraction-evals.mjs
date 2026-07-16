import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  DEFAULT_RANGE_AUDIO_BITS_PER_SECOND,
  MAX_LOCAL_CAPTURE_SECONDS,
  estimateLocalRangeExtraction,
} from "../src/lib/local-range-extraction.ts";

const workerSource = await readFile(
  new URL("../public/long-media-stream-worker.js", import.meta.url),
  "utf8",
);
const listeners = new Map();
const context = vm.createContext({
  self: {
    location: { origin: "http://localhost" },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  },
  URL,
  Response,
  Headers,
  ReadableStream,
  indexedDB: {},
  console,
  Error,
  Number,
  Math,
  Promise,
  Uint8Array,
});
vm.runInContext(workerSource, context, { filename: "long-media-stream-worker.js" });

assert.equal(typeof context.parseRangeHeader, "function");
assert.deepEqual(
  structuredClone(context.parseRangeHeader(null, 100)),
  { start: 0, end: 99, partial: false },
  "a request without Range must stream the complete recording",
);
assert.deepEqual(
  structuredClone(context.parseRangeHeader("bytes=10-19", 100)),
  { start: 10, end: 19, partial: true },
  "an explicit byte range must remain inclusive",
);
assert.deepEqual(
  structuredClone(context.parseRangeHeader("bytes=90-", 100)),
  { start: 90, end: 99, partial: true },
  "an open-ended byte range must stop at the final byte",
);
assert.deepEqual(
  structuredClone(context.parseRangeHeader("bytes=-8", 100)),
  { start: 92, end: 99, partial: true },
  "a suffix range must return the final requested bytes",
);
assert.equal(context.parseRangeHeader("bytes=100-101", 100), null);
assert.equal(context.parseRangeHeader("items=1-2", 100), null);
assert.ok(listeners.has("fetch"), "the worker must register a fetch handler");
assert.ok(listeners.has("message"), "the worker must allow immediate client claiming");

{
  const estimate = estimateLocalRangeExtraction(120, 120 + 15 * 60);
  assert.equal(estimate.durationSeconds, 15 * 60);
  assert.equal(estimate.estimatedWallSeconds, 15 * 60);
  assert.equal(
    estimate.estimatedBytes,
    Math.ceil((15 * 60 * DEFAULT_RANGE_AUDIO_BITS_PER_SECOND) / 8),
  );
}

{
  const invalid = estimateLocalRangeExtraction(60, 59);
  assert.equal(invalid.supported, false);
  assert.ok(invalid.reasons.some((reason) => reason.includes("positive duration")));
}

{
  const oversized = estimateLocalRangeExtraction(0, MAX_LOCAL_CAPTURE_SECONDS + 1);
  assert.equal(oversized.supported, false);
  assert.ok(oversized.reasons.some((reason) => reason.includes("limited")));
}

console.log("Local exact-range extraction deterministic evaluations passed.");
