import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  model,
  storage,
  uploadRoute,
  workspace,
  lifecycle,
  dataBoundary,
  appRoute,
  materialRoute,
  appShell,
  routeTree,
  evals,
  browserScenario,
  browserRunner,
  packageJson,
  checkScript,
  workflow,
  docs,
  status,
  plans,
] = await Promise.all([
  read("src/lib/long-media.ts"),
  read("src/lib/long-media-store.ts"),
  read("src/routes/app.lecture-media.tsx"),
  read("src/components/long-media-workspace.tsx"),
  read("src/components/long-media-lifecycle.tsx"),
  read("src/components/long-media-data-boundary.tsx"),
  read("src/routes/app.tsx"),
  read("src/routes/app.materials_.$materialId.tsx"),
  read("src/components/app-shell.tsx"),
  read("src/routeTree.gen.ts"),
  read("scripts/run-long-media-evals.mjs"),
  read("scripts/run-long-media-browser-e2e-v2.mjs"),
  read("scripts/run-long-media-browser-e2e-final.mjs"),
  read("package.json"),
  read("scripts/check.mjs"),
  read(".github/workflows/long-media.yml"),
  read("docs/LONG_MEDIA_ARCHITECTURE.md"),
  read("STATUS.md"),
  read("PLANS.md"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "LONG_MEDIA_CHUNK_BYTES = 8 * 1024 * 1024",
  "MAX_LONG_MEDIA_BYTES = 4 * 1024 * 1024 * 1024",
  "isLongMediaMaterial",
  "validateLongMediaFile",
  "buildTranscriptSegments",
  "parseTimedTranscript",
  'segment.status === "approved"',
  "lecture-transcript:",
]) {
  requireMarker(model, marker, `Long-media model is missing: ${marker}`);
}

for (const marker of [
  'DATABASE_NAME = "lamdan-long-media"',
  'MANIFEST_STORE = "manifests"',
  'CHUNK_STORE = "chunks"',
  'TRANSCRIPT_STORE = "transcripts"',
  "assertStorageCapacity",
  "requestDurableStorage",
  "uploadId",
  'crypto.subtle.digest("SHA-256"',
  "deleteChunksForUpload",
  "existing.uploadId !== uploadId",
  "let committed = false",
  "cleanup failed after commit",
  "if (!committed)",
  "options.signal?.aborted",
  "sourceUploadId",
  "getLongMediaBlob",
  "verifyLongMediaIntegrity",
  "clearAllLongMediaData",
  "pruneLongMediaData",
]) {
  requireMarker(storage, marker, `Long-media storage boundary is missing: ${marker}`);
}

for (const marker of [
  'createFileRoute("/app/lecture-media")',
  'accept="audio/*,video/*',
  "putLongMediaFile",
  "deleteLongMediaData(material.id)",
  'uid("mat")',
  "updateData((current)",
  "materials: [material",
  "onProgress: setProgress",
  "let manifest",
  "optional metadata finalization failed",
  "Лекция сохранена, но переход не открылся",
  "Сохранить лекцию локально",
  "до 4 ГБ",
  "staging",
  "Workspace ZIP",
]) {
  requireMarker(uploadRoute, marker, `Whole-lecture upload route is missing: ${marker}`);
}

for (const marker of [
  "getLongMediaBlob",
  "verifyLongMediaIntegrity",
  "parseTimedTranscript",
  "buildTranscriptSegments",
  "putLongMediaTranscript",
  "transcriptToMaterialChunks",
  "store.replaceMaterialChunksForMaterial",
  "Подтверждено как источник",
  "Автоматической отправки записи внешнему ИИ нет",
  "Загрузить плеер",
  "Проверить блоки",
  "Применить",
]) {
  requireMarker(workspace, marker, `Long-media review workspace is missing: ${marker}`);
}

for (const marker of [
  "ORPHAN_CONFIRMATION_MS = 15_000",
  "listLongMediaManifests",
  "getDataSnapshot",
  "deleteLongMediaData",
  "orphanSinceRef",
]) {
  requireMarker(lifecycle, marker, `Long-media orphan lifecycle is missing: ${marker}`);
}
for (const marker of [
  "Workspace ZIP v2 пока не включает сырой многогигабайтный файл",
  "getLongMediaStorageStats",
  "clearAllLongMediaData",
  "Удалить только записи",
]) {
  requireMarker(dataBoundary, marker, `Long-media data boundary is missing: ${marker}`);
}
for (const marker of ["<LongMediaLifecycle />", "<LongMediaDataBoundary />"]) {
  requireMarker(appRoute, marker, `App lifecycle wiring is missing: ${marker}`);
}
for (const marker of ["isLongMediaMaterial", "<LongMediaWorkspace material={material} />"]) {
  requireMarker(materialRoute, marker, `Material detail wiring is missing: ${marker}`);
}
for (const marker of [
  'to: "/app/lecture-media"',
  'to: "/app/exam-engine"',
  "Mic2",
  "GraduationCap",
]) {
  requireMarker(appShell, marker, `Primary navigation is missing: ${marker}`);
}
for (const marker of [
  "AppLectureMediaRouteImport",
  "AppExamEngineRouteImport",
  "'/app/lecture-media'",
  "'/app/exam-engine'",
]) {
  requireMarker(routeTree, marker, `Committed TanStack route tree is missing: ${marker}`);
}

for (const marker of [
  "a 65-minute lecture needs seven bounded transcript blocks",
  "SRT timing blocks must be parsed",
  "WebVTT timing blocks must be parsed",
  "only approved non-empty transcript blocks may become sources",
  "Long lecture media deterministic evaluations passed",
]) {
  requireMarker(evals, marker, `Long-media deterministic proof is missing: ${marker}`);
}
for (const marker of [
  "18 * 1024 * 1024",
  "storedUploadPredicate",
  "manifest.chunkCount === 3",
  "chunks.length === 3",
  "SHA-256 каждого локального блока совпадает",
  "core.materialChunks.length === 2",
  "Long lecture media browser E2E passed",
]) {
  requireMarker(browserScenario, marker, `Long-media browser scenario is missing: ${marker}`);
}
for (const marker of [
  "run-long-media-browser-e2e-v2.mjs",
  "earlyHardNavigation",
  "completedUploadNavigation",
  "spawnSync",
]) {
  requireMarker(browserRunner, marker, `Long-media browser runner is missing: ${marker}`);
}

for (const marker of ['"eval:long-media"', '"e2e:long-media"', '"verify:long-media-contract"']) {
  requireMarker(packageJson, marker, `package.json is missing: ${marker}`);
}
for (const marker of ['"verify:long-media-contract"', '"eval:long-media"']) {
  requireMarker(checkScript, marker, `Canonical checks are missing: ${marker}`);
}
for (const marker of [
  "Verify long lecture media contract",
  "Run long lecture media evaluations",
  "Build and verify generated route tree",
  "Run long lecture media browser E2E",
  "run-long-media-browser-e2e-final.mjs",
]) {
  requireMarker(workflow, marker, `Long-media workflow is missing: ${marker}`);
}

for (const [content, marker, file] of [
  [docs, "Chunked local storage", "docs/LONG_MEDIA_ARCHITECTURE.md"],
  [docs, "Review before apply", "docs/LONG_MEDIA_ARCHITECTURE.md"],
  [docs, "Raw-media backup boundary", "docs/LONG_MEDIA_ARCHITECTURE.md"],
  [status, "Durable whole-lecture audio/video intake", "STATUS.md"],
  [plans, "Whole-lecture media", "PLANS.md"],
  [plans, "P1-010A", "PLANS.md"],
  [plans, "P1-010B", "PLANS.md"],
]) {
  requireMarker(content, marker, `${file} is missing long-media delivery status: ${marker}`);
}

if (failures.length > 0) {
  console.error("Long lecture media contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Durable whole-lecture media contract passed.");
