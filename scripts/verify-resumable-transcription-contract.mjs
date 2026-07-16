import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  model,
  store,
  panel,
  materialRoute,
  lifecycle,
  dataBoundary,
  evals,
  browserE2E,
  docs,
  packageJson,
  checkScript,
  workflow,
] = await Promise.all([
  read("src/lib/resumable-transcription.ts"),
  read("src/lib/resumable-transcription-store.ts"),
  read("src/components/resumable-transcription-panel.tsx"),
  read("src/routes/app.materials_.$materialId.tsx"),
  read("src/components/long-media-lifecycle.tsx"),
  read("src/components/long-media-data-boundary.tsx"),
  read("scripts/run-resumable-transcription-evals.mjs"),
  read("scripts/run-resumable-transcription-browser-e2e.mjs"),
  read("docs/RESUMABLE_TRANSCRIPTION.md"),
  read("package.json"),
  read("scripts/check.mjs"),
  read(".github/workflows/resumable-transcription.yml"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "DEFAULT_RESUMABLE_RANGE_SECONDS = 15 * 60",
  "DEFAULT_RESUMABLE_OVERLAP_SECONDS = 2",
  "MAX_RESUMABLE_RANGES",
  "planResumableTranscriptionRanges",
  "createResumableTranscriptionJob",
  "recoverInterruptedResumableJob",
  "attachResumableRangeFile",
  "beginResumableRangeAttempt",
  "completeResumableRangeAttempt",
  "cancelResumableRangeAttempt",
  "mergeResumableTranscriptionSegments",
  "buildTranscriptDraftFromResumableJob",
  'status: "draft"',
  "older lecture upload",
  "revision: number",
  "deriveResumableTranscriptionJobStatus",
  "left.rangeId === right.rangeId",
  "sharedStart",
  "sharedEnd",
]) {
  requireMarker(model, marker, `Resumable transcription model is missing: ${marker}`);
}

for (const marker of [
  'DATABASE_NAME = "lamdan-resumable-transcription"',
  'JOB_STORE = "jobs"',
  "getResumableTranscriptionJob",
  "putResumableTranscriptionJob",
  "listResumableTranscriptionJobs",
  "pruneResumableTranscriptionJobs",
  "clearResumableTranscriptionJobs",
  "request.onblocked",
  "mergeResumableTranscriptionJobsForPersistence",
  "choosePersistedRange",
  "revision: Math.max",
  'existing.status === "draft_loaded"',
]) {
  requireMarker(store, marker, `Resumable transcription storage is missing: ${marker}`);
}

for (const marker of [
  "Возобновляемая расшифровка по диапазонам",
  "Lamdan пока не извлекает и не перекодирует",
  "createResumableTranscriptionJob",
  "requestAutomaticTranscription",
  "getLongMediaManifest(material.id)",
  "selectedCount",
  "Явное согласие на отдельные clips",
  "Запустить выбранные диапазоны",
  "Остановить текущий",
  "Загрузить объединённый draft",
  "buildTranscriptDraftFromResumableJob",
  "putLongMediaTranscript",
  "controller.signal.aborted",
  'job.status === "draft_loaded"',
]) {
  requireMarker(panel, marker, `Resumable transcription UI is missing: ${marker}`);
}

for (const marker of [
  "import { ResumableTranscriptionPanel }",
  "<ResumableTranscriptionPanel",
  "onDraftApplied",
]) {
  requireMarker(materialRoute, marker, `Material-detail integration is missing: ${marker}`);
}

for (const marker of [
  "listResumableTranscriptionJobs",
  "deleteResumableTranscriptionJob",
  "rangeJobIds",
  "ORPHAN_CONFIRMATION_MS = 15_000",
]) {
  requireMarker(lifecycle, marker, `Resumable orphan lifecycle is missing: ${marker}`);
}

for (const marker of [
  "clearResumableTranscriptionJobs",
  "listResumableTranscriptionJobs",
  "resumableQueueCount",
  "range queues",
  "transcriptCount",
]) {
  requireMarker(dataBoundary, marker, `Resumable data boundary is missing: ${marker}`);
}

for (const marker of [
  "a 65-minute lecture should use five bounded range clips",
  "duplicate overlap speech must merge",
  "unfinished ranges must remain visible as uncovered time",
  "tab recovery must preserve already completed range results",
  "one failed range must not erase successful range results",
  "same-range repeated utterances must not be deduplicated",
  "persisted overlap must match planner cap",
  "draft_loaded must remain sticky across stale writes",
  "Resumable long-file transcription deterministic evaluations passed",
]) {
  requireMarker(evals, marker, `Resumable transcription evaluation is missing: ${marker}`);
}

for (const marker of [
  "Resumable transcription browser E2E passed",
  "window.__resumableAttempts = 0",
  'job?.ranges?.[1]?.status === "failed"',
  "job?.ranges?.[1]?.attempt === 2",
  'transcript.segments.every((segment) => segment.status === "draft")',
  "core.materialChunks.length === 0",
  "await page.reload()",
]) {
  requireMarker(browserE2E, marker, `Resumable transcription browser proof is missing: ${marker}`);
}

for (const marker of [
  "Explicit provider boundary",
  "Resumable state",
  "Review and source integrity",
  "Automatic local audio extraction/transcoding is P1-010C2",
]) {
  requireMarker(docs, marker, `Resumable transcription documentation is missing: ${marker}`);
}

for (const marker of [
  '"eval:resumable-transcription"',
  '"e2e:resumable-transcription"',
  '"verify:resumable-transcription-contract"',
]) {
  requireMarker(packageJson, marker, `package.json is missing: ${marker}`);
}
for (const marker of [
  '"verify:resumable-transcription-contract"',
  '"eval:resumable-transcription"',
]) {
  requireMarker(checkScript, marker, `Canonical checks are missing: ${marker}`);
}
for (const marker of [
  "Verify resumable transcription contract",
  "Run resumable transcription evaluations",
  "Run resumable transcription browser E2E",
  "persist-credentials: false",
  "npm run typecheck",
  "npm run lint",
  "npm run build",
]) {
  requireMarker(workflow, marker, `Resumable transcription workflow is missing: ${marker}`);
}

if (failures.length > 0) {
  console.error("Resumable transcription contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Resumable long-file transcription contract passed.");
