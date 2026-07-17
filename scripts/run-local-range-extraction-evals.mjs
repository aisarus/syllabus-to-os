import assert from "node:assert/strict";
import {
  DEFAULT_LOCAL_EXTRACTION_BITRATE,
  estimateLocalRangeExtraction,
  validateExtractedRangeClip,
  validateLocalRangeExtractionRequest,
} from "../src/lib/local-range-extraction.ts";

const manifest = {
  materialId: "mat_local_extract",
  uploadId: "media_local_extract",
  fileName: "lecture.webm",
  mimeType: "video/webm",
  kind: "video",
  size: 2_000_000_000,
  chunkSize: 8 * 1024 * 1024,
  chunkCount: 239,
  durationSeconds: 5_400,
  createdAt: 1,
  updatedAt: 1,
};

const range = {
  id: "range_0_0",
  index: 0,
  startSeconds: 0,
  endSeconds: 900,
  status: "needs_file",
  attempt: 0,
  uploadProgress: 0,
  resultSegments: [],
  warnings: [],
  updatedAt: 1,
};

const estimate = estimateLocalRangeExtraction(manifest, range);
assert.equal(estimate.durationSeconds, 900);
assert.equal(estimate.processingSeconds, 900);
assert.equal(estimate.audioBitsPerSecond, DEFAULT_LOCAL_EXTRACTION_BITRATE);
assert(estimate.expectedOutputBytes > 10 * 1024 * 1024);
assert(estimate.expectedOutputBytes < 16 * 1024 * 1024);
assert(estimate.temporaryStorageBytes > estimate.expectedOutputBytes);
assert(estimate.workingMemoryBytes < 64 * 1024 * 1024);

const validated = validateLocalRangeExtractionRequest({
  manifest,
  range,
  maxOutputBytes: 24 * 1024 * 1024,
});
assert.deepEqual(validated, estimate);

assert.throws(
  () =>
    validateLocalRangeExtractionRequest({
      manifest,
      range: { ...range, startSeconds: 5_000, endSeconds: 5_500 },
    }),
  /outside the stored lecture duration/,
);

assert.throws(
  () =>
    validateLocalRangeExtractionRequest({
      manifest,
      range,
      maxOutputBytes: 2 * 1024 * 1024,
    }),
  /provider file-size boundary/,
);

validateExtractedRangeClip({
  expectedDurationSeconds: 900,
  capturedDurationSeconds: 899.4,
  size: estimate.expectedOutputBytes,
  mimeType: "audio/webm;codecs=opus",
  maxBytes: 24 * 1024 * 1024,
});

assert.throws(
  () =>
    validateExtractedRangeClip({
      expectedDurationSeconds: 900,
      capturedDurationSeconds: 880,
      size: estimate.expectedOutputBytes,
      mimeType: "audio/webm",
    }),
  /duration does not match/,
);

assert.throws(
  () =>
    validateExtractedRangeClip({
      expectedDurationSeconds: 60,
      capturedDurationSeconds: 60,
      size: 0,
      mimeType: "audio/webm",
    }),
  /empty clip/,
);

assert.throws(
  () =>
    validateExtractedRangeClip({
      expectedDurationSeconds: 60,
      capturedDurationSeconds: 60,
      size: 1_000,
      mimeType: "video/webm",
    }),
  /audio clip/,
);

console.log("Local range extraction evaluations passed.");
