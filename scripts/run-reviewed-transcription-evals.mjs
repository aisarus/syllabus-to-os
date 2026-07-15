import assert from "node:assert/strict";
import {
  GEMINI_TRANSCRIPTION_MAX_BYTES,
  buildTranscriptionRanges,
  createLongMediaTranscriptionJob,
  mergeProviderRangeIntoTranscript,
  normalizeProviderSegments,
  summarizeTranscriptionJob,
  validateGeminiTranscriptionEligibility,
} from "../src/lib/long-media-transcription.ts";
import { isAllowedGeminiUploadUrl } from "../src/lib/server/gemini-transcription.ts";

const manifest = {
  materialId: "mat_lecture",
  uploadId: "media_current",
  fileName: "lecture.webm",
  mimeType: "video/webm",
  kind: "video",
  size: 180 * 1024 * 1024,
  chunkSize: 8 * 1024 * 1024,
  chunkCount: 23,
  durationSeconds: 65 * 60,
  createdAt: 1,
  updatedAt: 1,
};

const ranges = buildTranscriptionRanges(manifest.durationSeconds);
assert.equal(ranges.length, 7, "a 65-minute lecture needs seven bounded ranges");
assert.deepEqual(
  ranges.map((range) => [range.startSeconds, range.endSeconds]),
  [
    [0, 600],
    [600, 1200],
    [1200, 1800],
    [1800, 2400],
    [2400, 3000],
    [3000, 3600],
    [3600, 3900],
  ],
);

assert.equal(validateGeminiTranscriptionEligibility(manifest).ok, true);
assert.equal(
  validateGeminiTranscriptionEligibility({ ...manifest, size: GEMINI_TRANSCRIPTION_MAX_BYTES + 1 }).ok,
  false,
  "provider boundary must block files over 2 GB without pretending local storage failed",
);
assert.equal(
  validateGeminiTranscriptionEligibility({ ...manifest, durationSeconds: undefined }).ok,
  false,
  "duration is required before bounded processing",
);

const job = createLongMediaTranscriptionJob(manifest, 10);
assert.equal(job.status, "awaiting_consent");
assert.equal(job.providerName, "Google Gemini Files API");
assert.equal(job.ranges.length, 7);
assert.equal("uploadUrl" in job, false, "resumable capability URLs must not enter persisted job state");
assert.equal("apiKey" in job, false, "provider secrets must not enter persisted job state");
assert.deepEqual(summarizeTranscriptionJob(job), {
  completedRanges: 0,
  totalRanges: 7,
  failedRanges: 0,
  percent: 0,
});

const currentTranscript = {
  materialId: manifest.materialId,
  sourceUploadId: manifest.uploadId,
  createdAt: 1,
  updatedAt: 1,
  segments: [
    {
      id: "approved_locked",
      startSeconds: 10,
      endSeconds: 30,
      text: "Human-approved wording",
      status: "approved",
    },
    {
      id: "old_draft",
      startSeconds: 30,
      endSeconds: 90,
      text: "Old provider draft",
      status: "draft",
    },
    {
      id: "outside",
      startSeconds: 700,
      endSeconds: 720,
      text: "Another reviewed range",
      status: "draft",
    },
  ],
};
const providerResult = {
  provider: "google-gemini-files",
  jobId: job.id,
  rangeId: ranges[0].id,
  startSeconds: 0,
  endSeconds: 600,
  segments: [
    {
      startSeconds: 12,
      endSeconds: 25,
      text: "Provider must not overwrite approved speech",
      speaker: "Lecturer",
      language: "he",
      unclear: false,
    },
    {
      startSeconds: 35,
      endSeconds: 80,
      text: "Fresh provider draft",
      speaker: "Lecturer",
      language: "he",
      unclear: false,
    },
  ],
  missingIntervals: [
    {
      startSeconds: 90,
      endSeconds: 100,
      reason: "Audio is unintelligible",
    },
  ],
};
const normalized = normalizeProviderSegments(providerResult);
assert.equal(normalized.length, 3, "missing audio must remain visible as an editable draft block");
assert.equal(normalized.some((segment) => segment.unclear), true);

const merged = mergeProviderRangeIntoTranscript(currentTranscript, manifest, providerResult, 20);
assert.equal(
  merged.segments.find((segment) => segment.id === "approved_locked")?.text,
  "Human-approved wording",
  "approved transcript text is immutable during provider retries",
);
assert.equal(
  merged.segments.some((segment) => segment.text === "Provider must not overwrite approved speech"),
  false,
  "provider segments overlapping approved speech must be discarded",
);
assert.equal(
  merged.segments.some((segment) => segment.text === "Old provider draft"),
  false,
  "unapproved overlapping provider content should be replaceable",
);
assert.equal(merged.segments.some((segment) => segment.text === "Fresh provider draft"), true);
assert.equal(merged.segments.some((segment) => segment.text === "Another reviewed range"), true);
assert.equal(merged.segments.some((segment) => segment.text === "Audio is unintelligible"), true);
assert.equal(
  merged.segments.filter((segment) => segment.status === "approved").length,
  1,
  "transcription completion must not manufacture approvals",
);

assert.equal(
  isAllowedGeminiUploadUrl(
    "https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=trusted",
  ),
  true,
);
assert.equal(isAllowedGeminiUploadUrl("https://example.com/upload/v1beta/files"), false);
assert.equal(isAllowedGeminiUploadUrl("http://generativelanguage.googleapis.com/upload/v1beta/files"), false);
assert.equal(
  isAllowedGeminiUploadUrl("https://generativelanguage.googleapis.com/v1beta/models"),
  false,
  "the chunk proxy must not accept arbitrary Google API paths",
);

console.log("Reviewed automatic transcription deterministic evaluations passed.");
