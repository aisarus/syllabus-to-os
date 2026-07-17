import assert from "node:assert/strict";
import {
  estimateLectureBackupFileBytes,
  getStreamingLectureBackupCapability,
  LECTURE_BACKUP_FORMAT,
  LECTURE_BACKUP_VERSION,
  validateLectureBackupManifest,
} from "../src/lib/lecture-backup.ts";

const hash = "a".repeat(64);
const manifest = {
  format: LECTURE_BACKUP_FORMAT,
  version: LECTURE_BACKUP_VERSION,
  createdAt: "2026-07-17T00:00:00.000Z",
  materialId: "mat_lecture",
  sourceUploadId: "upload_lecture",
  sourceFileName: "lecture.wav",
  sourceMimeType: "audio/wav",
  durationSeconds: 120,
  rawMediaBytes: 12,
  payloadBytes: 42,
  records: [
    { id: "core-material", kind: "coreMaterial", size: 10, sha256: hash },
    { id: "long-media-manifest", kind: "longMediaManifest", size: 20, sha256: hash },
    {
      id: "media-chunk:0",
      kind: "mediaChunk",
      size: 12,
      sha256: hash,
      metadata: { index: 0 },
    },
  ],
};

validateLectureBackupManifest(manifest);
assert(
  estimateLectureBackupFileBytes(manifest) > manifest.payloadBytes,
  "framed backup size must include the signature, headers and bundle manifest",
);

assert.throws(
  () =>
    validateLectureBackupManifest({
      ...manifest,
      records: [manifest.records[0], manifest.records[0], manifest.records[2]],
    }),
  /unique/,
  "duplicate record ids must be rejected",
);

assert.throws(
  () => validateLectureBackupManifest({ ...manifest, payloadBytes: manifest.payloadBytes + 1 }),
  /byte totals/,
  "payload total drift must be rejected",
);

assert.throws(
  () => validateLectureBackupManifest({ ...manifest, rawMediaBytes: 13 }),
  /byte totals/,
  "raw-media total drift must be rejected",
);

assert.throws(
  () =>
    validateLectureBackupManifest({
      ...manifest,
      records: manifest.records.map((record, index) =>
        index === 0 ? { ...record, sha256: "not-a-hash" } : record,
      ),
    }),
  /checksum/,
  "malformed SHA-256 values must be rejected",
);

assert.deepEqual(
  getStreamingLectureBackupCapability(),
  { supported: false, reason: "browser_only" },
  "non-browser execution must not claim native streaming export support",
);

console.log("Streaming lecture backup deterministic evaluations passed.");
