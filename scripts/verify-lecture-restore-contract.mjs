import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const restore = await readFile("src/lib/lecture-restore.ts", "utf8");
const panel = await readFile("src/components/lecture-restore-panel.tsx", "utf8");
const dataRoute = await readFile("src/routes/app.data.tsx", "utf8");
const mediaStore = await readFile("src/lib/long-media-store.ts", "utf8");
const docs = await readFile("docs/STREAMING_LECTURE_RESTORE.md", "utf8");
const browser = await readFile("scripts/run-lecture-restore-browser-e2e.mjs", "utf8");

for (const marker of [
  "prepareLectureRestore",
  "restoreLectureBackup",
  "rolling_back",
  "putLongMediaBackupChunk",
  "commitLongMediaBackupManifest",
  "deleteLongMediaUploadChunks",
  "putLongMediaTranscript",
  "putAutomaticTranscriptionJob",
  "putResumableTranscriptionJob",
  "putResumableRangeClip",
  "sourceUploadId",
  "unexpected trailing data",
  "checksum mismatch",
  "materials: [restoredMaterial",
]) {
  assert(restore.includes(marker), `Staged lecture restore is missing: ${marker}`);
}

assert(
  restore.indexOf("commitLongMediaBackupManifest") <
    restore.indexOf("materials: [restoredMaterial"),
  "Visible core material must publish after the verified long-media manifest.",
);
assert(
  !restore.includes("getLongMediaBlob"),
  "Restore must not reconstruct the complete lecture Blob.",
);
assert(mediaStore.includes("putLongMediaBackupChunk"));
assert(mediaStore.includes("commitLongMediaBackupManifest"));
assert(mediaStore.includes("deleteLongMediaUploadChunks"));
assert(panel.includes("Восстановить streaming lecture bundle"));
assert(panel.includes("Восстановить как новую лекцию"));
assert(panel.includes("staging полностью очищен"));
assert(dataRoute.includes("<LectureRestorePanel"));
assert(docs.includes("visible library last"));
assert(docs.includes("always restores as a duplicate"));
assert(browser.includes("Staged lecture restore Chromium E2E passed"));
assert(browser.includes("Restore reused the archived upload id"));
assert(browser.includes("Restore auto-created source chunks"));

console.log("Staged lecture restore contract verified.");
