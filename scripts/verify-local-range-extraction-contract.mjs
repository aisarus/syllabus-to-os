import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const extraction = await readFile("src/lib/local-range-extraction.ts", "utf8");
const store = await readFile("src/lib/resumable-transcription-store.ts", "utf8");
const panel = await readFile("src/components/resumable-transcription-panel.tsx", "utf8");
const docs = await readFile("docs/LOCAL_RANGE_EXTRACTION.md", "utf8");

for (const required of [
  "MediaRecorder",
  "createMediaStreamDestination",
  "playbackRate = 1",
  "getLongMediaBlob",
  "latestBefore.uploadId !== input.manifest.uploadId",
  "latestAfter.uploadId !== input.manifest.uploadId",
  "validateExtractedRangeClip",
  "Local extraction cancelled",
]) {
  assert(extraction.includes(required), `Missing local extraction boundary: ${required}`);
}

assert(
  !extraction.includes("sourceBlob.arrayBuffer"),
  "Local extraction must not decode the complete multi-gigabyte source into one ArrayBuffer.",
);
assert(store.includes("const DATABASE_VERSION = 2"));
assert(store.includes('const CLIP_STORE = "local-clips"'));
assert(store.includes("putResumableRangeClip"));
assert(store.includes("resumableRangeClipToFile"));
assert(panel.includes("Создать локально"));
assert(panel.includes("Явное согласие на отправку clips"));
assert(panel.includes("extractLongMediaRangeLocally"));
assert(panel.includes("listResumableRangeClips"));
assert(docs.includes("real time"));
assert(docs.includes("explicit consent"));
assert(docs.includes("sourceUploadId"));
assert(docs.includes("IndexedDB"));

console.log("Local range extraction contract verified.");
