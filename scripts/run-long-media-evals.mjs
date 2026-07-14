import assert from "node:assert/strict";
import {
  MAX_LONG_MEDIA_BYTES,
  buildTranscriptSegments,
  detectLongMediaKind,
  formatMediaTime,
  parseTimedTranscript,
  transcriptToMaterialChunks,
  validateLongMediaFile,
} from "../src/lib/long-media.ts";

{
  assert.equal(
    validateLongMediaFile({ name: "lecture.mp3", type: "audio/mpeg", size: 42_000_000 }).ok,
    true,
    "a normal long audio recording must be accepted",
  );
  assert.equal(
    detectLongMediaKind({ name: "lecture.mov", type: "" }),
    "video",
    "video extension fallback must work when the browser omits MIME",
  );
  assert.equal(
    validateLongMediaFile({ name: "lecture.pdf", type: "application/pdf", size: 1000 }).ok,
    false,
    "documents must not enter the long-media path",
  );
  assert.equal(
    validateLongMediaFile({ name: "huge.mp4", type: "video/mp4", size: MAX_LONG_MEDIA_BYTES + 1 })
      .ok,
    false,
    "files above the explicit 4 GB boundary must be rejected",
  );
}

{
  const segments = buildTranscriptSegments(65 * 60, 10 * 60);
  assert.equal(segments.length, 7, "a 65-minute lecture needs seven bounded transcript blocks");
  assert.equal(segments[0].startSeconds, 0);
  assert.equal(segments[0].endSeconds, 600);
  assert.equal(segments.at(-1)?.startSeconds, 3600);
  assert.equal(segments.at(-1)?.endSeconds, 3900);
  assert.equal(formatMediaTime(3723), "1:02:03");
}

{
  const segments = parseTimedTranscript(`1
00:00:00,000 --> 00:00:12,500
Введение в тему.

2
00:10:00,000 --> 00:10:42,000
Вторая часть лекции.`);
  assert.equal(segments.length, 2, "SRT timing blocks must be parsed");
  assert.equal(segments[0].text, "Введение в тему.");
  assert.equal(segments[1].startSeconds, 600);
  assert.equal(segments[1].status, "draft");
}

{
  const segments = parseTimedTranscript(`WEBVTT

00:00.000 --> 00:05.000
First point

00:05.000 --> 00:09.500 align:start
Second point`);
  assert.equal(segments.length, 2, "WebVTT timing blocks must be parsed");
  assert.equal(segments[1].endSeconds, 9.5);
}

{
  const chunks = transcriptToMaterialChunks([
    {
      id: "seg_1",
      startSeconds: 0,
      endSeconds: 600,
      text: "  Approved introduction.  ",
      status: "approved",
    },
    {
      id: "seg_2",
      startSeconds: 600,
      endSeconds: 1200,
      text: "Draft must not become a source.",
      status: "draft",
    },
    {
      id: "seg_3",
      startSeconds: 1200,
      endSeconds: 1800,
      text: "",
      status: "approved",
    },
  ]);
  assert.equal(chunks.length, 1, "only approved non-empty transcript blocks may become sources");
  assert.equal(chunks[0].text, "Approved introduction.");
  assert.equal(chunks[0].section, "lecture-transcript:0-600");
}

console.log("Long lecture media deterministic evaluations passed.");
