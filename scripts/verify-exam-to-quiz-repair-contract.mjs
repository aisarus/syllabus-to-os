import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [search, route, runner, resultList, browser] = await Promise.all([
  read("src/lib/quiz-repair-search.ts"),
  read("src/routes/app.quizzes_.$quizId.tsx"),
  read("src/components/quiz-repair-runner.tsx"),
  read("src/components/exam-result-review-list.tsx"),
  read("scripts/run-exam-to-quiz-repair-browser-e2e.mjs"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "parseQuizRepairQuestionIds",
  "serializeQuizRepairQuestionIds",
  "new Set",
  "slice(0, 100)",
]) {
  requireMarker(search, marker, `Repair search helper is missing: ${marker}`);
}

for (const marker of [
  "validateSearch",
  "parseQuizRepairQuestionIds",
  "repair.length > 0",
  "QuizRepairRunner",
  "requestedQuestionIds={repair}",
]) {
  requireMarker(route, marker, `Quiz repair route is missing: ${marker}`);
}

for (const marker of [
  "QuizRepairRunner",
  "validateQuestion",
  "requestedQuestionIds.flatMap",
  "recordQuizAttemptWithAnswers",
  'mode: "trainer"',
  "Repair после экзамена",
  "Frozen exam result не изменён",
  "В repair-ссылке не осталось валидных вопросов",
]) {
  requireMarker(runner, marker, `Quiz repair runner is missing: ${marker}`);
}

for (const marker of [
  "serializeQuizRepairQuestionIds",
  "issues.map",
  "Исправить эти вопросы",
  "search={{ repair: repair ? [repair] : [] }}",
]) {
  requireMarker(resultList, marker, `Exam result repair CTA is missing: ${marker}`);
}

for (const marker of [
  "A correct exam question leaked into repair mode",
  "Repair attempt included the wrong number of questions",
  "qq_wrong",
  "qq_unanswered",
  "Repair mutated the frozen exam snapshot",
  "focused repair attempt without mutating the exam",
]) {
  requireMarker(browser, marker, `Exam-to-repair browser proof is missing: ${marker}`);
}

if (failures.length > 0) {
  console.error("Exam-to-quiz repair contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Exam-to-quiz focused repair contract passed.");
