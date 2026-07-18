export const EXAM_RESULT_REVIEW_BROWSER_CONTRACT = [
  "2 вопросов требуют возврата к источнику",
  "/app/materials/mat_result",
  "/app/quizzes/quiz_result",
  "Viewing the result mutated the frozen exam snapshot",
  "Reload rewrote the frozen exam snapshot",
  "source-linked review without mutating the snapshot",
  "focused repair attempt without mutating the exam",
];

await import("./verify-exam-result-review-contract.mjs");
await import("./verify-exam-to-quiz-repair-contract.mjs");
await import("./run-exam-result-review-browser-proof.mjs");
await import("./run-exam-to-quiz-repair-browser-e2e.mjs");
