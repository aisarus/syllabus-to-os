import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  worker,
  streaming,
  extraction,
  clipStore,
  panel,
  route,
  lifecycle,
  dataBoundary,
  evals,
  docs,
  workflow,
] = await Promise.all([
  read("public/long-media-stream-worker.js"),
  read("src/lib/long-media-streaming.ts"),
  read("src/lib/local-range-extraction.ts"),
  read("src/lib/local-range-extraction-store.ts"),
  read("src/components/local-range-extraction-panel.tsx"),
  read("src/routes/app.materials_.$materialId.tsx"),
  read("src/components/long-media-lifecycle.tsx"),
  read("src/components/long-media-data-boundary.tsx"),
  read("scripts/run-local-range-extraction-evals.mjs"),
  read("docs/LOCAL_RANGE_EXTRACTION.md"),
  read(".github/workflows/local-range-extraction.yml"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  'STREAM_PREFIX = "/__lamdan_media__/"',
  'request.headers.get("range")',
  "parseRangeHeader",
  'status: partial ? 206 : 200',
  'status: 416',
  '"Content-Range"',
  '"Accept-Ranges"',
  "createRangeStream",
  "Math.floor(offset / manifest.chunkSize)",
  "record.blob.slice(localStart, localEnd)",
  "expectedUploadId && manifest.uploadId !== expectedUploadId",
  "db.close()",
]) {
  requireMarker(worker, marker, `IndexedDB media stream worker is missing: ${marker}`);
}

for (const marker of [
  "inspectLongMediaStreamingCapability",
  'navigator.serviceWorker.register(STREAM_WORKER_URL, { scope: "/" })',
  'LAM_DAN_CLAIM_CLIENTS',
  "buildLongMediaStreamUrl",
  'url.searchParams.set("uploadId", manifest.uploadId)',
  "window.isSecureContext",
]) {
  requireMarker(streaming, marker, `Long-media streaming client is missing: ${marker}`);
}

for (const marker of [
  "DEFAULT_RANGE_AUDIO_BITS_PER_SECOND = 64_000",
  "MAX_LOCAL_CAPTURE_SECONDS = 30 * 60",
  "estimateLocalRangeExtraction",
  "extractLocalAudioRange",
  "ensureLongMediaStreamWorker",
  "createMediaElementSource",
  "createMediaStreamDestination",
  "new MediaRecorder",
  "element.currentTime >= endSeconds",
  "element.playbackRate",
  "The local range capture produced an empty audio file",
  "The local range capture ended before the requested interval was complete",
  "sourceUploadId: manifest.uploadId",
]) {
  requireMarker(extraction, marker, `Local range extractor is missing: ${marker}`);
}

for (const marker of [
  'DATABASE_NAME = "lamdan-range-extraction"',
  'CLIP_STORE = "clips"',
  "putLocalRangeClip",
  "listLocalRangeClips",
  "deleteLocalRangeClipsForMaterial",
  "pruneLocalRangeClips",
  "clearLocalRangeClips",
  "localRangeClipToFile",
  "getLocalRangeClipStats",
  "sourceUploadId",
]) {
  requireMarker(clipStore, marker, `Local range clip storage is missing: ${marker}`);
}

for (const marker of [
  "Локально извлечь clips из оригинала",
  "HTTP Range-байты из IndexedDB",
  "extractLocalAudioRange",
  "putLocalRangeClip",
  "attachResumableRangeFile",
  "requestAutomaticTranscription",
  "providerConsent",
  "Отправить извлечённые clips",
  "buildTranscriptDraftFromResumableJob",
  'job.status === "draft_loaded"',
  "onQueueChanged",
  "onDraftApplied",
]) {
  requireMarker(panel, marker, `Local range extraction UI is missing: ${marker}`);
}

for (const marker of [
  'import { LocalRangeExtractionPanel }',
  "<LocalRangeExtractionPanel",
  "rangeQueueRevision",
  "onQueueChanged={refreshRangeQueue}",
]) {
  requireMarker(route, marker, `Material-detail extraction integration is missing: ${marker}`);
}

for (const marker of [
  "listLocalRangeClips",
  "deleteLocalRangeClipsForMaterial",
  "localClipIds",
  "ORPHAN_CONFIRMATION_MS = 15_000",
]) {
  requireMarker(lifecycle, marker, `Local clip lifecycle is missing: ${marker}`);
}

for (const marker of [
  "clearLocalRangeClips",
  "getLocalRangeClipStats",
  "extractedClipCount",
  "extractedClipBytes",
  "local clips",
]) {
  requireMarker(dataBoundary, marker, `Local clip data boundary is missing: ${marker}`);
}

for (const marker of [
  "a request without Range must stream the complete recording",
  "an explicit byte range must remain inclusive",
  "a suffix range must return the final requested bytes",
  "Local exact-range extraction deterministic evaluations passed",
]) {
  requireMarker(evals, marker, `Local range extraction evaluation is missing: ${marker}`);
}

for (const marker of [
  "IndexedDB streaming",
  "Exact real-time capture",
  "Provider handoff",
  "Persisted clip boundary",
  "Capability boundary",
  "real Chromium WAV fixture",
]) {
  requireMarker(docs, marker, `Local range extraction documentation is missing: ${marker}`);
}

for (const marker of [
  "Verify local range extraction contract",
  "Run local range extraction evaluations",
  "Run local range extraction browser E2E",
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

console.log("Local exact-range extraction contract passed.");
