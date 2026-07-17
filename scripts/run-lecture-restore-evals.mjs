import assert from "node:assert/strict";
import {
  LECTURE_BACKUP_FORMAT,
  LECTURE_BACKUP_MAGIC,
  LECTURE_BACKUP_VERSION,
} from "../src/lib/lecture-backup.ts";
import { prepareLectureRestore } from "../src/lib/lecture-restore.ts";

const encoder = new TextEncoder();
const hash = async (bytes) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
};

const frame = (descriptor, payload) => {
  const header = encoder.encode(
    JSON.stringify({
      format: LECTURE_BACKUP_FORMAT,
      version: LECTURE_BACKUP_VERSION,
      ...descriptor,
    }),
  );
  const prefix = new Uint8Array(4);
  new DataView(prefix.buffer).setUint32(0, header.byteLength, false);
  return [prefix, header, payload];
};

const now = Date.now();
const coreMaterial = {
  id: "mat_source",
  title: "Archived lecture",
  type: "lecture",
  sourceMode: "uploaded_file",
  fileName: "lecture.wav",
  mimeType: "audio/wav",
  fileSize: 4,
  courseId: "missing-course",
  tags: ["long-media"],
  rawText: "",
  processingStatus: "no_text",
  createdAt: now,
  updatedAt: now,
};
const mediaManifest = {
  materialId: "mat_source",
  uploadId: "media_source",
  fileName: "lecture.wav",
  mimeType: "audio/wav",
  kind: "audio",
  size: 4,
  chunkSize: 4,
  chunkCount: 1,
  durationSeconds: 1,
  createdAt: now,
  updatedAt: now,
};
const coreBytes = encoder.encode(JSON.stringify(coreMaterial));
const mediaBytes = encoder.encode(JSON.stringify(mediaManifest));
const chunkBytes = new Uint8Array([1, 2, 3, 4]);
const records = [
  {
    id: "core-material",
    kind: "coreMaterial",
    size: coreBytes.byteLength,
    sha256: await hash(coreBytes),
  },
  {
    id: "long-media-manifest",
    kind: "longMediaManifest",
    size: mediaBytes.byteLength,
    sha256: await hash(mediaBytes),
  },
  {
    id: "media-chunk:0",
    kind: "mediaChunk",
    size: chunkBytes.byteLength,
    sha256: await hash(chunkBytes),
    metadata: {
      index: 0,
      uploadId: "media_source",
      materialId: "mat_source",
      mimeType: "audio/wav",
    },
  },
];
const bundleManifest = {
  format: LECTURE_BACKUP_FORMAT,
  version: LECTURE_BACKUP_VERSION,
  createdAt: new Date(now).toISOString(),
  materialId: "mat_source",
  sourceUploadId: "media_source",
  sourceFileName: "lecture.wav",
  sourceMimeType: "audio/wav",
  durationSeconds: 1,
  rawMediaBytes: chunkBytes.byteLength,
  payloadBytes: records.reduce((sum, record) => sum + record.size, 0),
  records,
};
const bundleBytes = encoder.encode(JSON.stringify(bundleManifest));
const bundleDescriptor = {
  id: "bundle-manifest",
  kind: "longMediaManifest",
  size: bundleBytes.byteLength,
  sha256: await hash(bundleBytes),
  metadata: { bundleManifest: true },
};
const parts = [
  encoder.encode(LECTURE_BACKUP_MAGIC),
  ...frame(bundleDescriptor, bundleBytes),
  ...frame(records[0], coreBytes),
  ...frame(records[1], mediaBytes),
  ...frame(records[2], chunkBytes),
];
const file = new File(parts, "fixture.lamdan-lecture", {
  type: "application/x-lamdan-lecture-backup",
});

const plan = await prepareLectureRestore(file);
assert.equal(plan.sourceManifest.sourceUploadId, "media_source");
assert.equal(plan.sourceMaterial.title, "Archived lecture");
assert.equal(plan.sourceMediaManifest.chunkCount, 1);
assert.equal(plan.mediaChunkCount, 1);
assert.equal(plan.localClipCount, 0);
assert.match(plan.targetMaterialId, /^mat_/);
assert.match(plan.targetUploadId, /^media_restore_/);
assert.notEqual(plan.targetMaterialId, plan.sourceManifest.materialId);
assert.notEqual(plan.targetUploadId, plan.sourceManifest.sourceUploadId);
assert.equal(plan.restoredTitle, "Archived lecture (restored)");

const corruptBytes = new Uint8Array(await file.arrayBuffer());
corruptBytes[corruptBytes.length - 1] ^= 0xff;
await assert.rejects(
  () =>
    prepareLectureRestore(
      new File([corruptBytes], "corrupt.lamdan-lecture", {
        type: "application/x-lamdan-lecture-backup",
      }),
    ),
  /checksum mismatch/,
  "corrupt raw media must fail before staging",
);

await assert.rejects(
  () => prepareLectureRestore(new File([], "empty.lamdan-lecture")),
  /non-empty/,
  "empty restore files must be rejected",
);

console.log("Staged lecture restore deterministic evaluations passed.");
