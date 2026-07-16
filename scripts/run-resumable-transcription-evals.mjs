import assert from "node:assert/strict";
import {
  attachResumableRangeFile,
  beginResumableRangeAttempt,
  buildTranscriptDraftFromResumableJob,
  completeResumableRangeAttempt,
  createResumableTranscriptionJob,
  getResumableTranscriptionGaps,
  mergeResumableTranscriptionSegments,
  planResumableTranscriptionRanges,
  recoverInterruptedResumableJob,
  unresolvedResumableRanges,
  updateResumableRangeProgress,
} from "../src/lib/resumable-transcription.ts";
import { mergeResumableTranscriptionJobsForPersistence } from "../src/lib/resumable-transcription-store.ts";

const manifest = {
  materialId: "mat_long",
  uploadId: "upload_current",
  fileName: "lecture.mp4",
  mimeType: "video/mp4",
  kind: "video",
  size: 900_000_000,
  chunkSize: 8 * 1024 * 1024,
  chunkCount: 108,
  durationSeconds: 65 * 60,
  createdAt: 1,
  updatedAt: 1,
};

const providerStatus = {
  ok: true,
  provider: "openai-audio",
  displayName: "OpenAI Audio Transcriptions",
  configured: true,
  model: "gpt-4o-transcribe-diarize",
  maxBytes: 24 * 1024 * 1024,
  acceptedExtensions: ["mp3"],
  supportsSpeakerLabels: true,
  disclosure: "Explicit consent required.",
};

{
  const ranges = planResumableTranscriptionRanges(65 * 60, 15 * 60, 2);
  assert.equal(ranges.length, 5, "a 65-minute lecture should use five bounded range clips");
  assert.equal(ranges[0].startSeconds, 0);
  assert.equal(ranges.at(-1).endSeconds, 65 * 60);
  for (const [index, range] of ranges.entries()) {
    assert.ok(range.endSeconds - range.startSeconds <= 15 * 60);
    if (index > 0) {
      assert.equal(
        ranges[index - 1].endSeconds - range.startSeconds,
        2,
        "adjacent ranges must retain the configured two-second overlap",
      );
    }
  }
}

let job = createResumableTranscriptionJob({
  manifest,
  providerStatus,
  requestSpeakerLabels: true,
  language: "he",
});
assert.equal(job.status, "planning");
assert.equal(job.ranges.length, 5);
assert.equal(job.revision, 0);

job = attachResumableRangeFile(
  job,
  job.ranges[0].id,
  { name: "lecture-00-15.mp3", size: 5_000_000, type: "audio/mpeg" },
  providerStatus.maxBytes,
);
assert.equal(job.status, "ready");
job = beginResumableRangeAttempt(job, job.ranges[0].id);
job = updateResumableRangeProgress(job, job.ranges[0].id, 1);
assert.equal(job.ranges[0].status, "processing");
job = completeResumableRangeAttempt(job, job.ranges[0].id, {
  ok: true,
  requestId: "req_range_0",
  segments: [
    {
      id: "shared-left",
      startSeconds: 890,
      endSeconds: 900,
      text: "A shared overlap sentence.",
      speaker: "A",
    },
  ],
  warnings: [],
});
assert.equal(job.ranges[0].status, "review_ready");
assert.equal(job.ranges[0].resultSegments[0].startSeconds, 890);

job = attachResumableRangeFile(
  job,
  job.ranges[1].id,
  { name: "lecture-15-30.mp3", size: 5_100_000, type: "audio/mpeg" },
  providerStatus.maxBytes,
);
job = beginResumableRangeAttempt(job, job.ranges[1].id);
job = completeResumableRangeAttempt(job, job.ranges[1].id, {
  ok: true,
  requestId: "req_range_1",
  segments: [
    {
      id: "shared-right",
      startSeconds: 0,
      endSeconds: 5,
      text: "A shared overlap sentence.",
      speaker: "A",
    },
    {
      id: "new-right",
      startSeconds: 10,
      endSeconds: 20,
      text: "A new sentence after the overlap.",
      speaker: "B",
    },
  ],
  warnings: ["Review speaker change."],
});

const merged = mergeResumableTranscriptionSegments(job);
assert.equal(merged.length, 2, "duplicate overlap speech must merge instead of being repeated");
assert.equal(merged[0].startSeconds, 890);
assert.equal(merged[0].endSeconds, 903);
assert.equal(merged[1].startSeconds, 908);
assert.equal(job.ranges[1].providerRequestId, "req_range_1");
assert.equal(unresolvedResumableRanges(job).length, 3);

const draft = buildTranscriptDraftFromResumableJob(job, manifest);
assert.equal(draft.segments.length, 2);
assert.ok(draft.segments.every((segment) => segment.status === "draft"));
assert.ok(
  getResumableTranscriptionGaps(job).some((gap) => gap.endSeconds > 30 * 60),
  "unfinished ranges must remain visible as uncovered time",
);

assert.throws(
  () => buildTranscriptDraftFromResumableJob(job, { ...manifest, uploadId: "upload_replaced" }),
  /older lecture upload/,
  "a queue from a replaced lecture must not load into the editor",
);

{
  const interrupted = {
    ...job,
    ranges: job.ranges.map((range, index) =>
      index === 2
        ? {
            ...range,
            status: "uploading",
            selectedFileName: "lecture-30-45.mp3",
            selectedFileSize: 4_000_000,
            uploadProgress: 0.6,
          }
        : range,
    ),
  };
  const recovered = recoverInterruptedResumableJob(interrupted);
  assert.equal(recovered.ranges[2].status, "needs_file");
  assert.equal(recovered.ranges[2].uploadProgress, 0);
  assert.match(recovered.ranges[2].error ?? "", /Select the same range clip again/);
  assert.equal(
    recovered.ranges[0].status,
    "review_ready",
    "tab recovery must preserve already completed range results",
  );
}

{
  const failed = completeResumableRangeAttempt(
    beginResumableRangeAttempt(
      attachResumableRangeFile(
        job,
        job.ranges[2].id,
        { name: "lecture-30-45.mp3", size: 4_000_000, type: "audio/mpeg" },
        providerStatus.maxBytes,
      ),
      job.ranges[2].id,
    ),
    job.ranges[2].id,
    { ok: false, error: "Provider timeout" },
  );
  assert.equal(failed.ranges[2].status, "failed");
  assert.equal(
    mergeResumableTranscriptionSegments(failed).length,
    2,
    "one failed range must not erase successful range results",
  );
}

{
  const bounded = createResumableTranscriptionJob({
    manifest: { ...manifest, durationSeconds: 180 },
    providerStatus,
    requestSpeakerLabels: false,
    rangeSeconds: 60,
    overlapSeconds: 30,
  });
  assert.equal(bounded.rangeSeconds, 60);
  assert.equal(bounded.overlapSeconds, 15, "persisted overlap must match planner cap");
  assert.equal(bounded.ranges[1].startSeconds, 45);
}

{
  let repeated = createResumableTranscriptionJob({
    manifest: { ...manifest, durationSeconds: 60 },
    providerStatus,
    requestSpeakerLabels: false,
    rangeSeconds: 60,
    overlapSeconds: 0,
  });
  repeated = attachResumableRangeFile(
    repeated,
    repeated.ranges[0].id,
    { name: "repeat.mp3", size: 1000, type: "audio/mpeg" },
    providerStatus.maxBytes,
  );
  repeated = beginResumableRangeAttempt(repeated, repeated.ranges[0].id);
  repeated = completeResumableRangeAttempt(repeated, repeated.ranges[0].id, {
    ok: true,
    segments: [
      { id: "yes_1", startSeconds: 1, endSeconds: 2, text: "yes" },
      { id: "yes_2", startSeconds: 2.1, endSeconds: 3, text: "yes" },
    ],
  });
  assert.equal(
    mergeResumableTranscriptionSegments(repeated).length,
    2,
    "same-range repeated utterances must not be deduplicated",
  );
}

{
  const existing = {
    ...job,
    revision: 4,
    ranges: job.ranges.map((range, index) =>
      index === 0 ? { ...range, status: "review_ready", attempt: 1, updatedAt: 5000 } : range,
    ),
  };
  const stale = {
    ...job,
    revision: 2,
    ranges: job.ranges.map((range, index) =>
      index === 0 ? { ...range, status: "uploading", attempt: 1, updatedAt: 4000 } : range,
    ),
  };
  const persisted = mergeResumableTranscriptionJobsForPersistence(existing, stale, 6000);
  assert.equal(persisted.ranges[0].status, "review_ready");
  assert.equal(persisted.revision, 5);
}

{
  const loaded = { ...job, status: "draft_loaded", revision: 8 };
  const stale = { ...job, status: "review_ready", revision: 6 };
  const persisted = mergeResumableTranscriptionJobsForPersistence(loaded, stale, 7000);
  assert.equal(
    persisted.status,
    "draft_loaded",
    "draft_loaded must remain sticky across stale writes",
  );
}

console.log("Resumable long-file transcription deterministic evaluations passed.");
