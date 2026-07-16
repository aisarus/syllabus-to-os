import assert from "node:assert/strict";
import {
  MAX_AUTOMATIC_TRANSCRIPTION_BYTES,
  beginAutomaticTranscriptionJob,
  buildTranscriptDraftFromAutomaticJob,
  findAutomaticTranscriptionGaps,
  normalizeAutomaticSegments,
  validateAutomaticTranscriptionFile,
} from "../src/lib/automatic-transcription.ts";

const manifest = {
  materialId: "mat_lecture",
  uploadId: "media_current",
  fileName: "lecture.mp3",
  mimeType: "audio/mpeg",
  kind: "audio",
  size: 12 * 1024 * 1024,
  chunkSize: 8 * 1024 * 1024,
  chunkCount: 2,
  durationSeconds: 120,
  createdAt: 1,
  updatedAt: 2,
};

const providerStatus = {
  ok: true,
  provider: "openai-audio",
  displayName: "OpenAI Audio Transcriptions",
  configured: true,
  model: "gpt-4o-transcribe-diarize",
  maxBytes: MAX_AUTOMATIC_TRANSCRIPTION_BYTES,
  acceptedExtensions: ["mp3"],
  supportsSpeakerLabels: true,
  disclosure: "Explicit consent required.",
};

{
  assert.equal(
    validateAutomaticTranscriptionFile({
      name: "lecture.mp3",
      size: MAX_AUTOMATIC_TRANSCRIPTION_BYTES,
    }).ok,
    true,
    "the bounded provider limit must accept an exactly 24 MB file",
  );
  const oversized = validateAutomaticTranscriptionFile({
    name: "lecture.mp3",
    size: MAX_AUTOMATIC_TRANSCRIPTION_BYTES + 1,
  });
  assert.equal(oversized.ok, false, "a provider request above the bound must be rejected");
  assert.equal(
    validateAutomaticTranscriptionFile({ name: "lecture.mkv", size: 1024 }).ok,
    false,
    "unsupported provider formats must be explicit instead of silently uploaded",
  );
}

const normalized = normalizeAutomaticSegments(
  [
    {
      id: "second",
      startSeconds: 60,
      endSeconds: 90,
      text: "  second block  ",
      speaker: " B ",
    },
    {
      id: "first",
      startSeconds: 5,
      endSeconds: 40,
      text: "first block",
      uncertain: true,
      issues: ["Low confidence", "Low confidence"],
    },
    { id: "empty", startSeconds: 40, endSeconds: 50, text: "   " },
  ],
  120,
);
assert.deepEqual(
  normalized.map((segment) => segment.id),
  ["first", "second"],
  "provider segments must be trimmed, filtered and sorted by time",
);
assert.equal(normalized[1].speaker, "B", "speaker labels must be normalized without invention");
assert.deepEqual(
  normalized[0].issues,
  ["Low confidence"],
  "duplicate provider quality warnings must be collapsed",
);

const gaps = findAutomaticTranscriptionGaps(normalized, 120, 8);
assert.deepEqual(
  gaps,
  [
    { startSeconds: 40, endSeconds: 60 },
    { startSeconds: 90, endSeconds: 120 },
  ],
  "missing or unintelligible intervals must remain visible",
);

const firstJob = beginAutomaticTranscriptionJob({
  manifest,
  providerStatus,
  file: { name: "lecture.mp3", size: manifest.size, type: manifest.mimeType },
  usedProviderCopy: false,
  language: "he",
  requestSpeakerLabels: true,
});
assert.equal(firstJob.status, "uploading");
assert.equal(firstJob.attempt, 1);
assert.deepEqual(firstJob.resultSegments, []);

const readyJob = {
  ...firstJob,
  status: "review_ready",
  resultSegments: normalized,
};
const existing = {
  materialId: manifest.materialId,
  sourceUploadId: manifest.uploadId,
  segments: [
    {
      id: "approved_old",
      startSeconds: 0,
      endSeconds: 5,
      text: "previous approved draft text",
      status: "approved",
    },
  ],
  createdAt: 10,
  updatedAt: 11,
};
const existingSnapshot = structuredClone(existing);
const draft = buildTranscriptDraftFromAutomaticJob(readyJob, manifest, existing);
assert.ok(draft.segments.length === 2);
assert.ok(
  draft.segments.every((segment) => segment.status === "draft"),
  "provider output may never become approved source evidence automatically",
);
assert.equal(
  draft.createdAt,
  existing.createdAt,
  "the editable draft lineage should remain inspectable",
);
assert.deepEqual(
  existing,
  existingSnapshot,
  "building a provider draft must not mutate the current approved transcript",
);

assert.throws(
  () =>
    buildTranscriptDraftFromAutomaticJob(
      { ...readyJob, sourceUploadId: "media_old" },
      manifest,
      existing,
    ),
  /older lecture upload/,
  "provider output from a replaced recording must be rejected",
);

const retry = beginAutomaticTranscriptionJob({
  manifest,
  providerStatus,
  file: { name: "compressed-provider-copy.m4a", size: 5_000_000, type: "audio/mp4" },
  usedProviderCopy: true,
  requestSpeakerLabels: false,
  previous: { ...readyJob, status: "failed", error: "network" },
});
assert.equal(retry.attempt, 2, "retry count must survive failure and cancellation");
assert.equal(retry.usedProviderCopy, true);
assert.deepEqual(
  retry.resultSegments,
  [],
  "a retry must not pretend an older candidate is current",
);

console.log("Reviewed automatic transcription deterministic evaluations passed.");
