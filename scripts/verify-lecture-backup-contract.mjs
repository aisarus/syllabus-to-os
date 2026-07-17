import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const backup = await readFile("src/lib/lecture-backup.ts", "utf8");
const panel = await readFile("src/components/lecture-backup-panel.tsx", "utf8");
const route = await readFile("src/routes/app.materials_.$materialId.tsx", "utf8");
const longMediaStore = await readFile("src/lib/long-media-store.ts", "utf8");
const resumableStore = await readFile("src/lib/resumable-transcription-store.ts", "utf8");
const docs = await readFile("docs/STREAMING_LECTURE_BACKUP.md", "utf8");

for (const marker of [
  'LECTURE_BACKUP_FORMAT = "lamdan-lecture-backup"',
  'LECTURE_BACKUP_MAGIC = "LAM_DAN_LECTURE_BACKUP_V1',
  "prepareLectureBackupPlan",
  "saveLectureBackupPlan",
  "exportLectureBackupPlanToWritable",
  "inspectLectureBackupBlob",
  "validateLectureBackupManifest",
  "estimateLectureBackupFileBytes",
  "showSaveFilePicker",
  "sourceUploadId",
  "sha256Blob",
  "writable.abort",
  "getLongMediaChunkRecord",
  "getResumableRangeClip",
]) {
  assert(backup.includes(marker), `Streaming lecture backup is missing: ${marker}`);
}

assert(
  !backup.includes("getLongMediaBlob"),
  "Streaming backup must not reconstruct the complete lecture Blob.",
);
assert(
  !backup.includes("JSZip"),
  "Streaming lecture backup must not silently fall back to an in-memory ZIP.",
);
assert(longMediaStore.includes("export async function getLongMediaChunkRecord"));
assert(resumableStore.includes("export async function getResumableRangeClip"));
assert(panel.includes("Потоковая копия лекции"));
assert(panel.includes("Подготовить bundle"));
assert(panel.includes("Сохранить потоково"));
assert(panel.includes("SHA-256"));
assert(route.includes("<LectureBackupPanel"));
assert(docs.includes("never reconstructed as one Blob or ArrayBuffer"));
assert(docs.includes("P1-010C4"));

console.log("Streaming lecture backup contract verified.");
