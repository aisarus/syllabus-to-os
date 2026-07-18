import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [entry, summary, list, issue, restored, browser] = await Promise.all([
  read("src/components/exam-result-review.tsx"),
  read("src/components/exam-result-summary.tsx"),
  read("src/components/exam-result-review-list.tsx"),
  read("src/components/exam-result-issue-card.tsx"),
  read("src/components/exam-engine-restored-result.tsx"),
  read("scripts/run-exam-result-review-browser-e2e.mjs"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "ExamResultDecision",
  "ExamResultSummary",
  "ExamResultReviewList",
  "useData",
]) {
  requireMarker(entry, marker, `Result compositor is missing: ${marker}`);
}

for (const marker of [
  "Сохранённый frozen result",
  "факт этой попытки",
  "сырой score",
  "result.correctCount",
  "result.unansweredCount",
]) {
  requireMarker(summary, marker, `Result summary is missing: ${marker}`);
}

for (const marker of [
  "issues.length",
  "ExamResultIssueCard",
  'to="/app/quizzes/$quizId"',
  "Правильные ответы этой попытки",
  "К blueprints",
]) {
  requireMarker(list, marker, `Result review list is missing: ${marker}`);
}

for (const marker of [
  "sourceChunkIds",
  'to="/app/materials/$materialId"',
  "Открыть подтверждающий источник",
  "исходный chunk больше недоступен",
  "Правильный ответ",
  "без ответа",
]) {
  requireMarker(issue, marker, `Result issue card is missing: ${marker}`);
}

for (const marker of ["ExamResultDecision", "session={session}", "onExit={onExit}"]) {
  requireMarker(restored, marker, `Restored result wrapper is missing: ${marker}`);
}

for (const marker of [
  "2 вопросов требуют возврата к источнику",
  "/app/materials/mat_result",
  "/app/quizzes/quiz_result",
  "Viewing the result mutated the frozen exam snapshot",
  "Reload rewrote the frozen exam snapshot",
  "source-linked review without mutating the snapshot",
]) {
  requireMarker(browser, marker, `Result-review browser proof is missing: ${marker}`);
}

if (failures.length > 0) {
  console.error("Exam result-review contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Frozen Exam Engine result-review contract passed.");
