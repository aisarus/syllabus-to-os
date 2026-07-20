import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  model,
  jobStore,
  provider,
  statusRoute,
  transcriptionRoute,
  panel,
  materialRoute,
  lifecycle,
  dataBoundary,
  evals,
  browser,
  packageJson,
  checkScript,
  workflow,
  docs,
  status,
  plans,
] = await Promise.all([
  read("src/lib/automatic-transcription.ts"),
  read("src/lib/automatic-transcription-store.ts"),
  read("src/lib/server/automatic-transcription-provider.ts"),
  read("src/routes/api/ai/transcription-status.ts"),
  read("src/routes/api/ai/transcribe-long-media.ts"),
  read("src/components/automatic-transcription-panel.tsx"),
  read("src/routes/app.materials_.$materialId.tsx"),
  read("src/components/long-media-lifecycle.tsx"),
  read("src/components/long-media-data-boundary.tsx"),
  read("scripts/run-automatic-transcription-evals.mjs"),
  read("scripts/run-automatic-transcription-browser-e2e.mjs"),
  read("package.json"),
  read("scripts/check.mjs"),
  read(".github/workflows/automatic-transcription.yml"),
  read("docs/AUTOMATIC_TRANSCRIPTION.md"),
  read("STATUS.md"),
  read("PLANS.md"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "MAX_AUTOMATIC_TRANSCRIPTION_BYTES = 24 * 1024 * 1024",
  "AutomaticTranscriptionJobStatus",
  '"awaiting_consent"',
  '"review_ready"',
  '"cancelled"',
  '"failed"',
  "findAutomaticTranscriptionGaps",
  "buildTranscriptDraftFromAutomaticJob",
  'status: "draft"',
  "older lecture upload",
  "requestAutomaticTranscription",
  "XMLHttpRequest",
  'body.set("file"',
  "segment.startSeconds < maxDuration",
  "endSeconds: boundedEnd",
]) {
  requireMarker(model, marker, `Automatic transcription model/client is missing: ${marker}`);
}

for (const marker of [
  'DATABASE_NAME = "lamdan-automatic-transcription"',
  'JOB_STORE = "jobs"',
  "putAutomaticTranscriptionJob",
  "deleteAutomaticTranscriptionJob",
  "pruneAutomaticTranscriptionJobs",
  "clearAutomaticTranscriptionJobs",
]) {
  requireMarker(jobStore, marker, `Automatic transcription local job store is missing: ${marker}`);
}
for (const forbidden of ["OPENAI_API_KEY", "Authorization", "Bearer "]) {
  if (jobStore.includes(forbidden))
    failures.push(`Local job store must not contain provider secrets: ${forbidden}`);
}

for (const marker of [
  'DEFAULT_URL = "https://api.openai.com/v1/audio/transcriptions"',
  'DEFAULT_PLAIN_MODEL = "whisper-1"',
  'DEFAULT_SPEAKER_MODEL = "gpt-4o-transcribe-diarize"',
  "process.env.OPENAI_API_KEY",
  'form.set("chunking_strategy", "auto")',
  'form.append("timestamp_granularities[]", "segment")',
  "normalizeProviderSegments",
  "Low average token confidence",
  "no usable speech segments",
  "MB or smaller",
]) {
  requireMarker(provider, marker, `Server transcription provider is missing: ${marker}`);
}

for (const marker of [
  'createFileRoute("/api/ai/transcription-status")',
  "getAutomaticTranscriptionProviderStatus",
]) {
  requireMarker(statusRoute, marker, `Transcription status route is missing: ${marker}`);
}
for (const marker of [
  'createFileRoute("/api/ai/transcribe-long-media")',
  "parseAIFormDataRequest",
  "transcriptionMetadataSchema",
  "validateAutomaticTranscriptionFile",
  "transcribeWithConfiguredProvider",
  "request.signal",
]) {
  requireMarker(transcriptionRoute, marker, `Transcription upload route is missing: ${marker}`);
}

for (const marker of [
  "Проверяемая авторасшифровка",
  "Я явно разрешаю эту отправку",
  "Получатель:",
  "provider-копия",
  "OPENAI_API_KEY",
  "Отменить",
  "Повторить запрос",
  "Локальный candidate",
  "Непокрытые интервалы",
  "Перенести в редактор как draft",
  "все блоки останутся неподтверждёнными",
  "getLongMediaBlob",
  "putAutomaticTranscriptionJob",
  "putLongMediaTranscript",
  "window.confirm",
  "setProviderCopy(null)",
  "if (nextModel !== selectedModel) setConsent(false)",
]) {
  requireMarker(panel, marker, `Automatic transcription review UI is missing: ${marker}`);
}
const startIndex = panel.indexOf("const start = async");
const consentIndex = panel.indexOf("!consent", startIndex);
if (startIndex < 0 || consentIndex < 0) {
  failures.push("Provider upload must remain behind an explicit consent check.");
}

for (const marker of [
  "AutomaticTranscriptionPanel",
  "onDraftApplied",
  "transcriptRevision",
  "<LongMediaWorkspace",
  "key={material.id}",
]) {
  requireMarker(materialRoute, marker, `Long-media detail integration is missing: ${marker}`);
}
for (const marker of [
  "listAutomaticTranscriptionJobs",
  "deleteAutomaticTranscriptionJob",
  "ORPHAN_CONFIRMATION_MS = 15_000",
]) {
  requireMarker(lifecycle, marker, `Automatic transcription orphan safety is missing: ${marker}`);
}
for (const marker of [
  "clearAutomaticTranscriptionJobs",
  "provider candidates",
  "automaticCandidateCount",
]) {
  requireMarker(
    dataBoundary,
    marker,
    `Automatic transcription data controls are missing: ${marker}`,
  );
}

for (const marker of [
  "the bounded provider limit must accept",
  "missing or unintelligible intervals must remain visible",
  "normalized timestamps must never exceed the media duration",
  "provider output may never become approved source evidence automatically",
  "provider output from a replaced recording must be rejected",
  "Reviewed automatic transcription deterministic evaluations passed",
]) {
  requireMarker(evals, marker, `Automatic transcription deterministic proof is missing: ${marker}`);
}
for (const marker of [
  "Explicit consent",
  "cancelled",
  "review_ready",
  'status === "draft"',
  "source chunks",
  "Reviewed automatic transcription browser E2E passed",
  "lamdan-long-media deletion was blocked",
  "lamdan-automatic-transcription deletion was blocked",
]) {
  requireMarker(browser, marker, `Automatic transcription browser proof is missing: ${marker}`);
}

for (const marker of [
  '"eval:automatic-transcription"',
  '"e2e:automatic-transcription"',
  '"verify:automatic-transcription-contract"',
]) {
  requireMarker(packageJson, marker, `package.json is missing: ${marker}`);
}
for (const marker of [
  '"verify:automatic-transcription-contract"',
  '"eval:automatic-transcription"',
]) {
  requireMarker(checkScript, marker, `Canonical checks are missing: ${marker}`);
}
for (const marker of [
  "Verify automatic transcription contract",
  "Run automatic transcription evaluations",
  "Run automatic transcription browser E2E",
]) {
  requireMarker(workflow, marker, `Automatic transcription workflow is missing: ${marker}`);
}
for (const [content, marker, file] of [
  [docs, "Explicit consent", "docs/AUTOMATIC_TRANSCRIPTION.md"],
  [docs, "24 MB", "docs/AUTOMATIC_TRANSCRIPTION.md"],
  [docs, "Untrusted candidate", "docs/AUTOMATIC_TRANSCRIPTION.md"],
  [status, "Reviewed automatic transcription", "STATUS.md"],
  [plans, "P1-010B", "PLANS.md"],
]) {
  requireMarker(content, marker, `${file} is missing delivery status: ${marker}`);
}

if (failures.length > 0) {
  console.error("Reviewed automatic transcription contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Reviewed automatic transcription contract passed.");
