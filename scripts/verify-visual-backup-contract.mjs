import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [backup, workspaceBackup, visualStore, store, dataPage, checkScript, packageJson, workflow] =
  await Promise.all([
    read("src/lib/visual-backup.ts"),
    read("src/lib/workspace-backup.ts"),
    read("src/lib/visual-source-store.ts"),
    read("src/lib/store.ts"),
    read("src/routes/app.data.tsx"),
    read("scripts/check.mjs"),
    read("package.json"),
    read(".github/workflows/ci.yml"),
  ]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  'FULL_VISUAL_BACKUP_FORMAT = "lamdan-full-backup"',
  "FULL_VISUAL_BACKUP_VERSION = 1",
  "MAX_FULL_VISUAL_BACKUP_BYTES",
  "MAX_FULL_VISUAL_BACKUP_UNCOMPRESSED_BYTES",
  "createFullVisualBackup",
  "prepareFullVisualBackup",
  "previewFullVisualBackupImport",
  "applyFullVisualBackup",
  "manifest.json",
  "data.json",
  "images/",
  "ocr/",
  "processing/",
  "processed/",
  "sha256",
  "checkCRC32: true",
  "checksum mismatch",
  "Unsupported backup version",
  "replaceVisualSourceBackupSnapshot(plan.visual)",
  "replaceAllAtomically(plan.data)",
  "Full backup import was rolled back",
  "mergeAppDataSafely",
  "mergeVisualSnapshotSafely",
  "Skipped stale processed preview",
  "Source image is missing for material",
]) {
  requireMarker(backup, marker, `Full backup behavior is missing: ${marker}`);
}

for (const marker of [
  'from "./visual-backup"',
  "createLegacyFullVisualBackup",
  "prepareLegacyFullVisualBackup",
  "applyLegacyFullVisualBackup",
  "workspace/visual-backup-v1.zip",
]) {
  requireMarker(
    workspaceBackup,
    marker,
    `Workspace backup v2 no longer preserves the verified visual engine: ${marker}`,
  );
}

for (const marker of [
  "VisualSourceBackupSnapshot",
  "getVisualSourceBackupSnapshot",
  "replaceVisualSourceBackupSnapshot",
  'db.transaction(stores, "readwrite")',
  "for (const storeName of stores) transaction.objectStore(storeName).clear()",
  "transaction.objectStore(PROCESSED_IMAGE_STORE).put(processed)",
]) {
  requireMarker(visualStore, marker, `Visual source rollback cannot be atomic: ${marker}`);
}

for (const marker of [
  "parseAppDataJSON",
  "getDataSnapshot",
  "replaceAllAtomically",
  "localStorage.setItem(KEY, serialized)",
]) {
  requireMarker(store, marker, `Text-data restore is not guarded: ${marker}`);
}

for (const marker of [
  "Workspace ZIP v2",
  "visual ZIP",
  "createFullVisualBackup",
  "prepareFullVisualBackup",
  "previewFullVisualBackupImport",
  "applyFullVisualBackup",
  "Merge safely",
  "Replace everything",
  "application/zip,.zip",
  "Все payload проверены",
]) {
  requireMarker(dataPage, marker, `Backup UI is missing an explicit safe workflow: ${marker}`);
}

requireMarker(
  packageJson,
  '"verify:visual-backup-contract"',
  "package.json no longer exposes the visual-backup contract.",
);
requireMarker(
  checkScript,
  '"verify:visual-backup-contract"',
  "npm run check no longer runs the visual-backup contract.",
);
requireMarker(
  workflow,
  "Verify visual backup contract",
  "CI no longer verifies the visual-backup contract before typecheck/build.",
);

if (failures.length > 0) {
  console.error("Visual backup contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Versioned visual ZIP engine remains intact under the workspace backup v2 wrapper.");
