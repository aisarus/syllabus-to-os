import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  model,
  store,
  workspace,
  restoredResult,
  route,
  evals,
  browserE2E,
  browserRunner,
  docs,
  workflow,
] = await Promise.all([
  read("src/lib/exam-engine.ts"),
  read("src/lib/exam-engine-store.ts"),
  read("src/components/exam-engine.tsx"),
  read("src/components/exam-engine-restored-result.tsx"),
  read("src/routes/app.exam-engine.tsx"),
  read("scripts/run-exam-engine-evals.mjs"),
  read("scripts/run-exam-engine-browser-e2e.mjs"),
  read("scripts/run-exam-engine-browser-e2e-final.mjs"),
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

for (const marker of [
  "Замороженный результат экзамена",
  "Результат восстановлен из локальной frozen session после reload",
  "сырой score",
  "Правильный ответ",
  "К blueprints",
]) {
  requireMarker(restoredResult, marker, `Restored Exam result surface is missing: ${marker}`);
}

for (const marker of [
  'createFileRoute("/app/exam-engine")',
  "const data = useData()",
  "const exams = useExamEngineData()",
  "data.courses.length === 0",
  'session.status === "submitted" && session.result',
  "<ExamEngineRestoredResult",
  "setShowRestoredResult(false)",
  "<ExamEngine key=",
  "data.quizzes.length",
]) {
  requireMarker(route, marker, `Exam Engine hydrated route is missing: ${marker}`);
}

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
  "functionalBlueprintWait",
  'input[type="checkbox"]',
  "currentQuestionId",
  "functionalResultWait",
  "submitted-result diagnostics",
  "Сохранить и начать",
  "spawnSync",
]) {
  requireMarker(browserRunner, marker, `Functional Exam Engine browser runner is missing: ${marker}`);
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
  "run-exam-engine-browser-e2e-final.mjs",
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
