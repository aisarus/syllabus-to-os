import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  engine,
  reviewModel,
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
  read("src/lib/concept-evidence.ts"),
  read("src/lib/open-answer-review.ts"),
  read("src/lib/open-answer-review-client.ts"),
  read("src/lib/server/open-answer-review-generation.ts"),
  read("src/routes/api/ai/review-open-answer.ts"),
  read("src/components/concept-open-answer-review.tsx"),
  read("src/routes/app.courses_.$courseId.tsx"),
  read("scripts/run-open-answer-evidence-evals.mjs"),
  read("scripts/run-open-answer-evidence-browser-e2e.mjs"),
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
  '"open_answer_review"',
  "OpenAnswerReviewMode",
  "sourceChunkIds?: string[]",
  "prompt?: string",
  "response?: string",
  "reviewMode?: OpenAnswerReviewMode",
  "reviewSummary?: string",
  "repairOfEvidenceId?: string",
  'event.sourceType === "open_answer_review"',
  'event.reviewMode === "ai_human"',
  "repair.conceptId === event.conceptId",
  'repair.outcome === "failure"',
  "evidenceIsObjective",
]) {
  requireMarker(engine, marker, `Concept evidence open-answer model is missing: ${marker}`);
}

for (const marker of [
  "normalizeOpenAnswerReview",
  "validateOpenAnswerSaveDraft",
  "At least one current concept source is required",
  "The answer is too short to review",
  "formatOpenAnswerReviewSummary",
  'reviewMode: "human" | "ai_human"',
]) {
  requireMarker(reviewModel, marker, `Open-answer review safeguards are missing: ${marker}`);
}

for (const marker of ['fetch("/api/ai/review-open-answer"', "reviewOpenAnswer", "repairContext"]) {
  requireMarker(client, marker, `Open-answer review client is missing: ${marker}`);
}

for (const marker of [
  'OPEN_ANSWER_REVIEW_PROMPT_VERSION = "open-answer-review-v1"',
  "Judge ONLY against facts, distinctions and terminology explicitly present in SOURCE CHUNKS",
  "Never use model memory or outside knowledge",
  "A human must confirm outcome and mistake type before evidence is saved",
  "supportedSourceChunkIds",
  "notFoundInSources=true",
  "runOpenAnswerReviewGeneration",
  "repairContext",
]) {
  requireMarker(
    server,
    marker,
    `Source-grounded open-answer server boundary is missing: ${marker}`,
  );
}

for (const marker of [
  'createFileRoute("/api/ai/review-open-answer")',
  "runOpenAnswerReviewGeneration(body)",
  "Invalid JSON body",
]) {
  requireMarker(apiRoute, marker, `Open-answer API route is missing: ${marker}`);
}

for (const marker of [
  "Открытый ответ и исправление ошибки",
  "Ответ сохраняется только после твоего решения",
  "AI — только предложение",
  "Human-only review остаётся вторичным evidence",
  "reviewOpenAnswer",
  "validateOpenAnswerSaveDraft",
  'reviewMode: review ? "ai_human" : "human"',
  'sourceType: "open_answer_review"',
  "repairOfEvidenceId",
  "Я лично проверил ответ, outcome, тип ошибки и source chunks",
  "Сохранить попытку исправления",
  "Ошибки, которые можно исправить",
  "История открытых ответов",
  "conceptStore.deleteEvidence",
]) {
  requireMarker(workspace, marker, `Open-answer evidence UI is missing: ${marker}`);
}
requireMarker(
  courseRoute,
  "<ConceptOpenAnswerReview courseId={courseId} />",
  "Course route does not expose open-answer evidence and repair.",
);

for (const marker of [
  "human-only open answer must remain secondary",
  "unknown citations must never survive an open-answer review",
  "repair must keep the original failure inspectable",
  "repair must never overwrite the original failure",
  "orphan repair links must be removed",
  "deleted source chunks must remove open-answer evidence",
  "Open-answer evidence and mistake repair evaluations passed",
]) {
  requireMarker(evals, marker, `Open-answer evaluation is missing: ${marker}`);
}

for (const marker of [
  "Open-answer evidence and mistake repair browser E2E passed",
  "Сохранить evidence",
  "Сохранить попытку исправления",
  "repairOfEvidenceId",
  "originalStillExists",
  "humanOnly",
  "await page.reload()",
]) {
  requireMarker(browserE2E, marker, `Open-answer browser proof is missing: ${marker}`);
}

for (const marker of [
  '"eval:open-answer-evidence"',
  '"e2e:open-answer-evidence"',
  '"verify:open-answer-evidence-contract"',
]) {
  requireMarker(packageJson, marker, `package.json is missing: ${marker}`);
}
for (const marker of ['"verify:open-answer-evidence-contract"', '"eval:open-answer-evidence"']) {
  requireMarker(checkScript, marker, `Canonical checks are missing: ${marker}`);
}
for (const marker of [
  "Verify open-answer evidence and repair contract",
  "Run open-answer evidence evaluations",
  "Run open-answer evidence browser E2E",
  "open_answer_e2e",
  "open-answer-e2e-output.txt",
]) {
  requireMarker(workflow, marker, `CI open-answer evidence gate is missing: ${marker}`);
}
for (const [content, marker, file] of [
  [docs, "Open-answer evidence and mistake repair", "docs/CONCEPT_EVIDENCE_MODEL.md"],
  [status, "Open-answer evidence and mistake repair", "STATUS.md"],
  [plans, "Open-answer evidence and mistake repair", "PLANS.md"],
]) {
  requireMarker(content, marker, `${file} is missing open-answer evidence status: ${marker}`);
}

if (failures.length > 0) {
  console.error("Open-answer evidence and mistake repair contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Open-answer evidence, human confirmation and linked repair contract passed.");
