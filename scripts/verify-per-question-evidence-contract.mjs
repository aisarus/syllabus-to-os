import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [details, engine, conceptStore, lifecycle, experience, route, evals, docs, tasks, status] =
  await Promise.all([
    read("src/lib/quiz-attempt-details.ts"),
    read("src/lib/concept-evidence.ts"),
    read("src/lib/concept-store.ts"),
    read("src/components/concept-evidence-lifecycle.tsx"),
    read("src/components/evidence-quiz-experience.tsx"),
    read("src/routes/app.quizzes_.$quizId.tsx"),
    read("scripts/run-per-question-evidence-evals.mjs"),
    read("docs/CONCEPT_EVIDENCE_MODEL.md"),
    read("TASKS.md"),
    read("STATUS.md"),
  ]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "lamdan.quiz-attempt-details.v1",
  "QuizAttemptAnswerSnapshot",
  "questionPrompt",
  "selectedOption",
  "correctOption",
  "buildQuizAttemptAnswerSnapshots",
  "recordQuizAttemptWithAnswers",
  "inspectWorkspacePersistence",
  "reconcileQuizAttemptDetails",
]) {
  requireMarker(details, marker, `Attempt-detail contract is missing: ${marker}`);
}

for (const marker of [
  '"quiz_question_answer"',
  "attemptId?: string",
  "questionId?: string",
  "detailsByAttemptId",
  "detail.answers.some",
]) {
  requireMarker(engine, marker, `Concept evidence schema is missing: ${marker}`);
}

for (const marker of [
  "New attempts with immutable answer snapshots",
  'kind: "recognition"',
  'outcome: answer.correct ? "success" : "failure"',
  'mistakeKind: answer.correct ? undefined : "unclassified"',
  "Historical attempts without snapshots remain neutral",
]) {
  requireMarker(conceptStore, marker, `Question-level evidence sync is missing: ${marker}`);
}

for (const marker of [
  "useQuizAttemptDetailData",
  "reconcileQuizAttemptDetails(hydratedCore)",
  "syncQuizAttemptEvidence(hydratedCore, hydratedDetails)",
]) {
  requireMarker(lifecycle, marker, `Question-detail lifecycle is missing: ${marker}`);
}

for (const marker of [
  "Evidence-aware квиз",
  "immutable snapshot",
  "recordQuizAttemptWithAnswers",
  "onClickCapture={blockLegacyRunner}",
  "Запускай тест через evidence-aware тренажёр",
  "Редактирование вопроса позже не изменит эту историю",
]) {
  requireMarker(experience, marker, `Evidence-aware quiz UI is missing: ${marker}`);
}

requireMarker(
  route,
  "<EvidenceQuizExperience quizId={quizId} />",
  "Quiz detail route does not use the evidence-aware runner.",
);

for (const marker of [
  "attempt history must be immutable",
  "aggregate context must disappear when detailed answers exist",
  "unlinked question evidence must be repaired",
]) {
  requireMarker(evals, marker, `Per-question evidence evaluation is missing: ${marker}`);
}

for (const [content, marker, file] of [
  [docs, "Per-question quiz evidence", "docs/CONCEPT_EVIDENCE_MODEL.md"],
  [tasks, "per-question quiz evidence", "TASKS.md"],
  [status, "per-question quiz evidence", "STATUS.md"],
]) {
  requireMarker(content, marker, `${file} is missing per-question evidence status: ${marker}`);
}

if (failures.length > 0) {
  console.error("Per-question evidence contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Per-question quiz evidence contract passed.");
