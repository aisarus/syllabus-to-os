import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  details,
  engine,
  conceptStore,
  lifecycle,
  experience,
  resultDecision,
  quizRoute,
  examRoute,
  evals,
  browserE2E,
  repairBrowserE2E,
  packageJson,
  workflow,
  docs,
  tasks,
  status,
] = await Promise.all([
  read("src/lib/quiz-attempt-details.ts"),
  read("src/lib/concept-evidence.ts"),
  read("src/lib/concept-store.ts"),
  read("src/components/concept-evidence-lifecycle.tsx"),
  read("src/components/evidence-quiz-experience.tsx"),
  read("src/components/quiz-result-decision.tsx"),
  read("src/routes/app.quizzes_.$quizId.tsx"),
  read("src/routes/app.exam-engine.tsx"),
  read("scripts/run-per-question-evidence-evals.mjs"),
  read("scripts/run-question-evidence-browser-e2e.mjs"),
  read("scripts/run-quiz-repair-browser-e2e.mjs"),
  read("package.json"),
  read(".github/workflows/ci.yml"),
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
  "QuizResultDecision",
  "repairQuestionIds",
  "startRepair",
  "Режим исправления",
]) {
  requireMarker(experience, marker, `Evidence-aware quiz UI is missing: ${marker}`);
}

for (const marker of [
  "QuizResultDecision",
  "Повторить только ошибки",
  "Открыть подтверждающий источник",
  "Продолжить в Exam Engine",
  'to="/app/exam-engine"',
  "course: courseId",
  "quiz: quizId",
  "Это факт только об этой попытке",
]) {
  requireMarker(resultDecision, marker, `Quiz result decision path is missing: ${marker}`);
}

requireMarker(
  quizRoute,
  "<EvidenceQuizExperience quizId={quizId} />",
  "Quiz detail route does not use the evidence-aware runner.",
);

for (const marker of [
  "validateSearch",
  "Контекст диагностики",
  "requestedQuiz",
  "planningCourseId",
]) {
  requireMarker(examRoute, marker, `Exam Engine diagnostic context is missing: ${marker}`);
}

for (const marker of [
  "attempt history must be immutable",
  "aggregate context must disappear when detailed answers exist",
  "unlinked question evidence must be repaired",
]) {
  requireMarker(evals, marker, `Per-question evidence evaluation is missing: ${marker}`);
}

for (const marker of [
  'localStorage.getItem("lamdan.quiz-attempt-details.v1")',
  'event.sourceType === "quiz_question_answer"',
  "await page.reload()",
  "Recognition evidence duplicated or disappeared after reload",
  "Question-level quiz evidence browser E2E passed",
]) {
  requireMarker(browserE2E, marker, `Question evidence browser proof is missing: ${marker}`);
}

for (const marker of [
  "Distractor one",
  "Повторить только ошибки (1)",
  "Режим исправления",
  "Verified answer",
  "Original mistake changed",
  "Repair history did not survive reload",
]) {
  requireMarker(repairBrowserE2E, marker, `Quiz repair browser proof is missing: ${marker}`);
}

requireMarker(
  packageJson,
  '"e2e:question-evidence"',
  "package.json does not expose the question evidence browser gate.",
);
for (const marker of [
  "Run question evidence browser E2E",
  "question_evidence_e2e",
  "question-evidence-e2e-output.txt",
]) {
  requireMarker(workflow, marker, `CI question evidence gate is missing: ${marker}`);
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
