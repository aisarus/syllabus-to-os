import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  model,
  browser,
  storage,
  resumable,
  panel,
  lifecycle,
  dataBoundary,
  evals,
  browserE2E,
  docs,
  tasks,
  status,
  plans,
  packageJson,
  checkScript,
  workflow,
] = await Promise.all([
  read("src/lib/local-range-extraction.ts"),
  read("src/lib/local-range-extraction-browser.ts"),
  read("src/lib/local-range-extraction-store.ts"),
  read("src/lib/resumable-transcription.ts"),
  read("src/components/resumable-transcription-panel.tsx"),
  read("src/components/long-media-lifecycle.tsx"),
  read("src/components/long-media-data-boundary.tsx"),
  read("scripts/run-local-range-extraction-evals.mjs"),
  read("scripts/run-local-range-extraction-browser-e2e.mjs"),
  read("docs/LOCAL_RANGE_EXTRACTION.md"),
  read("TASKS.md"),
  read("STATUS.md"),
  read("PLANS.md"),
  read("package.json"),
  read("scripts/check.mjs"),
  read(".github/workflows/local-range-extraction.yml"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "LOCAL_RANGE_EXTRACTION_TARGET_BITS_PER_SECOND = 160_000",
  "LOCAL_RANGE_EXTRACTION_DURATION_TOLERANCE_SECONDS",
  "LOCAL_RANGE_EXTRACTION_SEEK_TOLERANCE_SECONDS",
  "detectLocalRangeExtractionCapability",
  "estimateLocalRangeExtraction",
  "selectLocalRangeExtractionDurationEvidence",
  "validateLocalRangeExtractionPromotion",
  "sameLocalRangeExtractionIdentity",
  "audio/webm;codecs=opus",
  "The conservative local recording estimate exceeds the provider file limit",
]) {
  requireMarker(model, marker, `Local range extraction model is missing: ${marker}`);
}

for (const marker of [
  "captureStream",
  "MediaRecorder",
  "audioBitsPerSecond: 160_000",
  "media.playbackRate !== 1",
  "waitForSeek",
  "appendLocalRangeExtractionChunk",
  "deleteLocalRangeExtractionClip(stage.id)",
  "assertLocalStorageCapacity",
  "readMediaDuration",
  "capturedDurationSeconds",
  "The local recording has no verifiable duration evidence",
  "The browser could not seek to the exact persisted range boundary",
]) {
  requireMarker(browser, marker, `Local range browser runtime is missing: ${marker}`);
}
if (/\.arrayBuffer\s*\(/.test(browser)) {
  failures.push(
    "Local range browser runtime must not read the complete source through arrayBuffer().",
  );
}
if (/\bfetch\s*\(/.test(browser)) {
  failures.push("Local range browser runtime must not upload or fetch while extracting a clip.");
}

for (const marker of [
  'DATABASE_NAME = "lamdan-local-range-extraction"',
  'status: "staging"',
  'status: "ready"',
  "beginLocalRangeExtractionStage",
  "appendLocalRangeExtractionChunk",
  "finalizeLocalRangeExtractionStage",
  "getLocalRangeExtractionFile",
  "deleteLocalRangeExtractionClip",
  "deleteLocalRangeExtractionClipsForMaterial",
  "chunkCount",
]) {
  requireMarker(storage, marker, `Local range extraction storage is missing: ${marker}`);
}

for (const marker of [
  "localExtraction?: LocalRangeExtractionProvenance",
  "attachLocallyExtractedResumableRangeFile",
  "invalidateLocallyExtractedResumableRangeFile",
  "recordLocalRangeExtractionFailure",
  "validateLocalRangeExtractionPromotion",
  "The browser interrupted this upload",
]) {
  requireMarker(resumable, marker, `C1 range queue integration is missing: ${marker}`);
}

for (const marker of [
  "Извлечь локально",
  "extractLocalRangeFromStoredMedia",
  "deleteLocalRangeExtractionClipsForMaterial",
  "Локально извлечён",
  "Локальное извлечение",
  "Ручной выбор C1 остаётся доступен",
]) {
  requireMarker(panel, marker, `Local range extraction UI is missing: ${marker}`);
}

for (const marker of [
  "listLocalRangeExtractionClips",
  "deleteLocalRangeExtractionClipsForMaterial",
  "localClipIds",
]) {
  requireMarker(
    lifecycle,
    marker,
    `Local range extraction lifecycle cleanup is missing: ${marker}`,
  );
}
for (const marker of [
  "listLocalRangeExtractionClips",
  "clearLocalRangeExtractionClips",
  "localExtractedClipCount",
  "localExtractedClipBytes",
]) {
  requireMarker(dataBoundary, marker, `Local range extraction data boundary is missing: ${marker}`);
}

for (const marker of [
  "manual C1 fallback must remain available",
  "a conservative oversize estimate must be rejected",
  "a clip from another persisted range identity must be rejected",
  "a capture timing mismatch must stay visible",
  "a missing WebM container duration may use only measured source capture time",
  "a local capture failure must remain visible on its range",
  "an interrupted upload may recover to ready",
  "Local range extraction deterministic evaluations passed",
]) {
  requireMarker(evals, marker, `Local range extraction evaluation is missing: ${marker}`);
}

for (const marker of [
  "captureStream",
  "Two-second local lecture",
  "Извлечь локально",
  'clip?.status === "ready"',
  "core.materialChunks.length === 0",
  "Local range extraction browser E2E passed",
]) {
  requireMarker(browserE2E, marker, `Local range extraction browser proof is missing: ${marker}`);
}

for (const [content, marker, file] of [
  [docs, "Local-only capture path", "docs/LOCAL_RANGE_EXTRACTION.md"],
  [docs, "Honest browser boundary", "docs/LOCAL_RANGE_EXTRACTION.md"],
  [docs, "Persistence and recovery", "docs/LOCAL_RANGE_EXTRACTION.md"],
  [tasks, "P1-010C2 implementation boundary", "TASKS.md"],
  [status, "P1-010C2", "STATUS.md"],
  [plans, "Automatic local range extraction/transcoding", "PLANS.md"],
]) {
  requireMarker(content, marker, `${file} is missing local range extraction context: ${marker}`);
}

for (const marker of [
  '"eval:local-range-extraction"',
  '"e2e:local-range-extraction"',
  '"verify:local-range-extraction-contract"',
]) {
  requireMarker(packageJson, marker, `package.json is missing: ${marker}`);
}
for (const marker of [
  '"verify:local-range-extraction-contract"',
  '"eval:local-range-extraction"',
]) {
  requireMarker(checkScript, marker, `Canonical checks are missing: ${marker}`);
}
for (const marker of [
  "Verify local range extraction contract",
  "Run local range extraction evaluations",
  "Run local range extraction browser E2E",
  "persist-credentials: false",
  "npm run typecheck",
  "npm run lint",
  "npm run build",
]) {
  requireMarker(workflow, marker, `Local range extraction workflow is missing: ${marker}`);
}

if (failures.length > 0) {
  console.error("Local range extraction contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Local range extraction contract passed.");
