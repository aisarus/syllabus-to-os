import assert from "node:assert/strict";
import {
  LOCAL_RANGE_EXTRACTION_DURATION_TOLERANCE_SECONDS,
  createLocalRangeExtractionFileName,
  detectLocalRangeExtractionCapability,
  estimateLocalRangeExtraction,
  selectLocalRangeExtractionDurationEvidence,
  validateLocalRangeExtractionPromotion,
} from "../src/lib/local-range-extraction.ts";
import {
  attachLocallyExtractedResumableRangeFile,
  attachResumableRangeFile,
  createResumableTranscriptionJob,
  recordLocalRangeExtractionFailure,
  recoverInterruptedResumableJob,
} from "../src/lib/resumable-transcription.ts";

const maxBytes = 24 * 1024 * 1024;
const identity = {
  materialId: "mat_local",
  sourceUploadId: "upload_local",
  rangeId: "range_0_0",
  startSeconds: 0,
  endSeconds: 15 * 60,
};
const file = {
  name: createLocalRangeExtractionFileName("lecture.mp4", identity),
  size: 18 * 1024 * 1024,
  type: "audio/webm;codecs=opus",
};
const provenance = {
  ...identity,
  clipId: "local_clip_eval",
  fileName: file.name,
  mimeType: "audio/webm",
  byteSize: file.size,
  durationSeconds: 15 * 60,
  estimatedBytes: 20 * 1024 * 1024,
  wallTimeMilliseconds: 15 * 60 * 1000,
  createdAt: 1,
};

{
  const capability = detectLocalRangeExtractionCapability({
    mediaElementCapture: true,
    mediaRecorder: true,
    isTypeSupported: (mimeType) => mimeType === "audio/webm;codecs=opus",
  });
  assert.equal(capability.supported, true);
  assert.equal(capability.mimeType, "audio/webm;codecs=opus");
  assert.equal(
    detectLocalRangeExtractionCapability({
      mediaElementCapture: false,
      mediaRecorder: true,
      isTypeSupported: () => true,
    }).supported,
    false,
    "manual C1 fallback must remain available when captureStream is absent",
  );
  assert.equal(
    detectLocalRangeExtractionCapability({
      mediaElementCapture: true,
      mediaRecorder: true,
      isTypeSupported: () => false,
    }).supported,
    false,
    "unsupported recorder MIME must not be promoted optimistically",
  );
}

{
  const estimate = estimateLocalRangeExtraction({ durationSeconds: 15 * 60, maxBytes });
  assert.equal(estimate.ok, true, "a default 15-minute range should fit conservatively");
  assert.ok(estimate.expectedBytes < maxBytes);
  assert.equal(
    estimate.estimatedWallTimeSeconds,
    15 * 60,
    "local capture must report normal-speed elapsed time instead of pretending to transcode instantly",
  );
  assert.equal(
    estimateLocalRangeExtraction({ durationSeconds: 30 * 60, maxBytes }).ok,
    false,
    "a conservative oversize estimate must be rejected before the recorder starts",
  );
}

assert.equal(
  selectLocalRangeExtractionDurationEvidence({
    capturedDurationSeconds: 15 * 60 - 0.2,
  }),
  15 * 60 - 0.2,
  "a missing WebM container duration may use only measured source capture time",
);
assert.equal(
  selectLocalRangeExtractionDurationEvidence({
    containerDurationSeconds: 15 * 60,
    capturedDurationSeconds: 15 * 60 - 0.2,
  }),
  15 * 60,
  "finite container metadata must stay the preferred duration evidence",
);
assert.equal(
  selectLocalRangeExtractionDurationEvidence({}),
  undefined,
  "the requested duration must never be fabricated when both duration signals are absent",
);

assert.equal(
  validateLocalRangeExtractionPromotion({
    expected: identity,
    provenance,
    file,
    actualDurationSeconds: 15 * 60,
    maxBytes,
  }).ok,
  true,
  "a matching local WebM range may enter the C1 queue",
);
assert.equal(
  validateLocalRangeExtractionPromotion({
    expected: identity,
    provenance: { ...provenance, endSeconds: identity.endSeconds - 1 },
    file,
    actualDurationSeconds: 15 * 60,
    maxBytes,
  }).ok,
  false,
  "a clip from another persisted range identity must be rejected",
);
assert.equal(
  validateLocalRangeExtractionPromotion({
    expected: identity,
    provenance,
    file,
    actualDurationSeconds: 15 * 60 - LOCAL_RANGE_EXTRACTION_DURATION_TOLERANCE_SECONDS - 0.1,
    maxBytes,
  }).ok,
  false,
  "a capture timing mismatch must stay visible instead of shifting transcript timestamps",
);
assert.equal(
  validateLocalRangeExtractionPromotion({
    expected: identity,
    provenance,
    file: { ...file, type: "audio/mpeg" },
    actualDurationSeconds: 15 * 60,
    maxBytes,
  }).ok,
  false,
  "the promoted clip MIME must be recorded WebM audio",
);
assert.equal(
  validateLocalRangeExtractionPromotion({
    expected: identity,
    provenance,
    file: { ...file, size: maxBytes + 1 },
    actualDurationSeconds: 15 * 60,
    maxBytes,
  }).ok,
  false,
  "the final recorded byte size must still satisfy the provider limit",
);

const manifest = {
  materialId: "mat_local",
  uploadId: "upload_local",
  fileName: "lecture.mp4",
  mimeType: "video/mp4",
  kind: "video",
  size: 900_000_000,
  chunkSize: 8 * 1024 * 1024,
  chunkCount: 108,
  durationSeconds: 15 * 60,
  createdAt: 1,
  updatedAt: 1,
};
const providerStatus = {
  ok: true,
  provider: "openai-audio",
  displayName: "OpenAI Audio Transcriptions",
  configured: true,
  model: "gpt-4o-transcribe-diarize",
  maxBytes,
  acceptedExtensions: ["webm"],
  supportsSpeakerLabels: true,
  disclosure: "Explicit consent required.",
};

let job = createResumableTranscriptionJob({
  manifest,
  providerStatus,
  requestSpeakerLabels: true,
});
job = attachLocallyExtractedResumableRangeFile(
  job,
  job.ranges[0].id,
  file,
  { ...provenance, rangeId: job.ranges[0].id },
  maxBytes,
);
assert.equal(job.ranges[0].status, "ready");
assert.equal(job.ranges[0].localExtraction?.clipId, "local_clip_eval");
const preservedAfterFailedReplacement = recordLocalRangeExtractionFailure(
  job,
  job.ranges[0].id,
  "The browser recorder failed while creating the local range.",
);
assert.equal(
  preservedAfterFailedReplacement.ranges[0].status,
  "ready",
  "a failed replacement must not erase an already-ready local clip",
);
assert.equal(
  preservedAfterFailedReplacement.ranges[0].error,
  "The browser recorder failed while creating the local range.",
  "a local capture failure must remain visible on its range",
);
assert.equal(
  recoverInterruptedResumableJob({
    ...job,
    ranges: job.ranges.map((range) =>
      range.id === job.ranges[0].id
        ? { ...range, status: "uploading", uploadProgress: 0.5 }
        : range,
    ),
  }).ranges[0].status,
  "ready",
  "an interrupted upload may recover to ready only when the C2 clip is persisted locally",
);
job = attachResumableRangeFile(
  job,
  job.ranges[0].id,
  { name: "manual.webm", size: 1000, type: "audio/webm" },
  maxBytes,
);
assert.equal(
  job.ranges[0].localExtraction,
  undefined,
  "a manual C1 replacement must not claim stale local-extraction provenance",
);

console.log("Local range extraction deterministic evaluations passed.");
