import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [model, store, workspace, route, evals, browserE2E, docs, workflow] = await Promise.all([
  read("src/lib/exam-engine.ts"),
  read("src/lib/exam-engine-store.ts"),
  read("src/components/exam-engine.tsx"),
  read("src/routes/app.exam-engine.tsx"),
  read("scripts/run-exam-engine-evals.mjs"),
  read("scripts/run-exam-engine-browser-e2e.mjs"),
  read("docs/EXAM_ENGINE_V1.md"),
  read(".github/workflows/exam-engine.yml"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "ExamBlueprint",
  "FrozenExamQuestion",
  "ExamSession",
  "ExamResult",
  "validateExamBlueprint",
  "has no approved source relationship",
  "freezeExamQuestions",
  "createFrozenExamSession",
  "answerExamQuestion",
  "The exam deadline has passed",
  "submitExamSession",
  "unansweredCount",
  "timedOut",
  "normalizeExamEngineData",
]) {
  requireMarker(model, marker, `Exam model is missing: ${marker}`);
}

for (const marker of [
  'KEY = "lamdan.exam-engine.v1"',
  "Exam Engine data could not be verified after saving",
  "createBlueprint",
  "startSession",
  "answerExamQuestion",
  "submitExamSession",
  "publishExamAttempt",
  "buildQuizAttemptAnswerSnapshots",
  'mode: "exam"',
  "replaceQuizAttemptDetailData(previousDetails)",
  "inspectWorkspacePersistence",
]) {
  requireMarker(store, marker, `Exam store is missing: ${marker}`);
}

for (const marker of [
  "Source-grounded экзамены",
  "Вопросы заморожены",
  "Экзамен стартует только из source-linked вопросов",
  "Итог — сырой score",
  "validateExamBlueprint",
  "examEngineStore.createBlueprint",
  "examEngineStore.startSession",
  "examEngineStore.answer",
  "examEngineStore.submit",
  "Question-level evidence создан только для отвеченных вопросов",
  "Неподанные ответы не превращаются в выдуманные failure events",
  "Сдать экзамен",
]) {
  requireMarker(workspace, marker, `Exam Engine UI is missing: ${marker}`);
}

requireMarker(
  route,
  'createFileRoute("/app/exam-engine")',
  "Exam Engine route is missing.",
);
requireMarker(route, "<ExamEngine />", "Exam Engine route does not render its workspace.");

for (const marker of [
  "an ungrounded question must block exam start",
  "question edits must not rewrite a frozen exam session",
  "unanswered exam questions must remain explicit instead of becoming invented failures",
  "Frozen source-grounded Exam Engine evaluations passed",
]) {
  requireMarker(evals, marker, `Exam Engine evaluation is missing: ${marker}`);
}

for (const marker of [
  "Frozen Exam Engine browser E2E passed",
  'localStorage.getItem("lamdan.exam-engine.v1")',
  'localStorage.getItem("lamdan.quiz-attempt-details.v1")',
  'event.sourceType === "quiz_question_answer"',
  "unansweredCount === 0",
  "await page.reload()",
]) {
  requireMarker(browserE2E, marker, `Exam Engine browser proof is missing: ${marker}`);
}

for (const marker of [
  "Frozen session",
  "Source-grounded question bank",
  "Partial answers",
  "No grade prediction",
  "Question-level evidence",
]) {
  requireMarker(docs, marker, `Exam Engine documentation is missing: ${marker}`);
}

for (const marker of [
  "Verify Exam Engine contract",
  "Run Exam Engine evaluations",
  "Run Exam Engine browser E2E",
  "npm run typecheck",
  "npm run lint",
  "npm run build",
]) {
  requireMarker(workflow, marker, `Exam Engine workflow is missing: ${marker}`);
}

if (failures.length > 0) {
  console.error("Exam Engine v1 contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Frozen source-grounded Exam Engine v1 contract passed.");
