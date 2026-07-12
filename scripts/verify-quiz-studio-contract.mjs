import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const library = await readFile(
  resolve(process.cwd(), "src/components/quiz-library.tsx"),
  "utf8",
);
const studio = await readFile(
  resolve(process.cwd(), "src/components/quiz-studio.tsx"),
  "utf8",
);
const listRoute = await readFile(
  resolve(process.cwd(), "src/routes/app.quizzes.tsx"),
  "utf8",
);
const detailRoute = await readFile(
  resolve(process.cwd(), "src/routes/app.quizzes.$quizId.tsx"),
  "utf8",
);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "validateQuestion",
  "courseFilter",
  "materialFilter",
  "store.createQuiz",
  "invalid",
]) {
  requireMarker(library, marker, `Quiz library is missing required behavior: ${marker}`);
}

for (const marker of [
  'startMode("practice")',
  'startMode("exam")',
  "Invalid questions remain editable but are never silently included",
  "writeQuestionOrder",
  "moveQuestion",
  "store.updateQuestion",
  "store.recordAttempt",
  "SourceReferenceLinks",
  "detectQuestionDuplicates",
  "DuplicateQuestionDialog",
  "Other questions are deleted only after confirmation",
  "Answers, correct options, and explanations remain hidden until submission",
  "Practice with immediate feedback",
]) {
  requireMarker(studio, marker, `Quiz Studio is missing required behavior: ${marker}`);
}

requireMarker(listRoute, "QuizLibrary", "The active quiz list route no longer uses QuizLibrary.");
requireMarker(detailRoute, "QuizStudio", "The active quiz detail route no longer uses QuizStudio.");

if (failures.length) {
  console.error("Quiz Studio contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Quiz Studio v1 contract passed.");
