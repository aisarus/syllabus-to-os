import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  model,
  client,
  server,
  apiRoute,
  workspace,
  courseRoute,
  evals,
  browserE2E,
  packageJson,
  checkScript,
  workflow,
  docs,
  status,
  plans,
] = await Promise.all([
  read("src/lib/concept-extraction.ts"),
  read("src/lib/concept-extraction-client.ts"),
  read("src/lib/server/concept-extraction-generation.ts"),
  read("src/routes/api/ai/extract-concepts.ts"),
  read("src/components/concept-extraction-review.tsx"),
  read("src/routes/app.courses_.$courseId.tsx"),
  read("scripts/run-concept-extraction-evals.mjs"),
  read("scripts/run-concept-extraction-browser-e2e.mjs"),
  read("package.json"),
  read("scripts/check.mjs"),
  read(".github/workflows/ci.yml"),
  read("docs/CONCEPT_EVIDENCE_MODEL.md"),
  read("STATUS.md"),
  read("PLANS.md"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "ConceptCandidateOrigin",
  "normalizeConceptCandidate",
  "findConceptDuplicate",
  "extractStudyPackConceptCandidates",
  "parseStudyPackKeyTerms",
  "ConceptCandidateRejectionReason",
  "ConceptCandidateAcceptancePlan",
  "planConceptCandidateAcceptance",
  '"duplicate_existing"',
  '"duplicate_batch"',
  "acceptedConcepts",
  'note.tags.includes("study-pack")',
  "sourceChunkIds.length === 0",
]) {
  requireMarker(model, marker, `Concept candidate model is missing: ${marker}`);
}

for (const marker of [
  'fetch("/api/ai/extract-concepts"',
  "generateConceptCandidatesDraft",
  "existingConceptTitles",
  "requestedSourceChunkIds",
]) {
  requireMarker(client, marker, `Concept extraction client is missing: ${marker}`);
}

for (const marker of [
  'CONCEPT_EXTRACTION_PROMPT_VERSION = "concept-extraction-v1"',
  "Use ONLY facts and terminology explicitly present in SOURCE CHUNKS",
  "Every candidate must list one or more exact sourceChunkIds",
  "Do not repeat or paraphrase an EXISTING CONCEPT",
  "If a candidate lacks direct source support, omit it instead of guessing",
  "uncitedItemCount",
  "rejectedSourceChunkIds",
  "normalizeDraft",
  "runConceptExtractionGeneration",
]) {
  requireMarker(server, marker, `Concept extraction server trust boundary is missing: ${marker}`);
}

for (const marker of [
  'createFileRoute("/api/ai/extract-concepts")',
  "conceptExtractionInputSchema",
  "handleAIJsonRequest",
  "runConceptExtractionGeneration",
]) {
  requireMarker(apiRoute, marker, `Concept extraction API route is missing: ${marker}`);
}

for (const marker of [
  "Сначала кандидаты, потом решение человека",
  "Ничего не добавляется в карту знаний до твоего подтверждения",
  "принятие кандидата не создаёт learning evidence",
  "MAX_SELECTED_CHUNKS = 8",
  "generateConceptCandidatesDraft",
  "extractStudyPackConceptCandidates",
  "findConceptDuplicate",
  "normalizeConceptCandidate",
  "planConceptCandidateAcceptance",
  "finalBatchPreview",
  "rejectionByCandidateId",
  "Финальная проверка повторно сравнит все title и aliases после ручных правок",
  "После ручных правок title или alias совпадает с другим кандидатом",
  "conceptStore.createConcept",
  "sourceChunkIds: normalized.sourceChunkIds",
  "Проверь формулировку и каждую source-связь",
  "Добавить выбранные",
]) {
  requireMarker(workspace, marker, `Reviewed concept extraction UI is missing: ${marker}`);
}
requireMarker(
  courseRoute,
  "<ConceptExtractionReview courseId={courseId} />",
  "Course route does not expose reviewed concept extraction.",
);

for (const marker of [
  "uncited concept candidates must not survive normalization",
  "an alias collision must be treated as an existing concept duplicate",
  "manual alias/title edits must be rechecked against the full accepted batch",
  '"duplicate_batch"',
  '"duplicate_existing"',
  "Reviewed concept extraction evaluations passed",
]) {
  requireMarker(evals, marker, `Concept extraction evaluation is missing: ${marker}`);
}

for (const marker of [
  "Reviewed concept extraction browser E2E passed",
  "Проверка перед добавлением",
  "Добавить выбранные",
  'localStorage.getItem("lamdan.concept-evidence.v1")',
  "evidenceEvents.length === 0",
]) {
  requireMarker(browserE2E, marker, `Concept extraction browser proof is missing: ${marker}`);
}

for (const marker of [
  '"eval:concept-extraction"',
  '"e2e:concept-extraction"',
  '"verify:concept-extraction-contract"',
]) {
  requireMarker(packageJson, marker, `package.json is missing: ${marker}`);
}
for (const marker of ['"verify:concept-extraction-contract"', '"eval:concept-extraction"']) {
  requireMarker(checkScript, marker, `Canonical checks are missing: ${marker}`);
}
for (const marker of [
  "Verify reviewed concept extraction contract",
  "Run reviewed concept extraction evaluations",
  "Run reviewed concept extraction browser E2E",
  "concept_extraction_e2e",
  "concept-extraction-e2e-output.txt",
]) {
  requireMarker(workflow, marker, `CI reviewed concept extraction gate is missing: ${marker}`);
}
for (const [content, marker, file] of [
  [docs, "Reviewed concept extraction", "docs/CONCEPT_EVIDENCE_MODEL.md"],
  [status, "Reviewed concept extraction", "STATUS.md"],
  [plans, "Reviewed concept extraction", "PLANS.md"],
]) {
  requireMarker(
    content,
    marker,
    `${file} is missing reviewed concept extraction status: ${marker}`,
  );
}

if (failures.length > 0) {
  console.error("Reviewed concept extraction contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Reviewed source-grounded concept extraction contract passed.");
