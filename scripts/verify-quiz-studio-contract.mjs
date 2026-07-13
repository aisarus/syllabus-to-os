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
const experience = await readFile(
  resolve(process.cwd(), "src/components/golden-quiz-experience.tsx"),
  "utf8",
);
const feedback = await readFile(
  resolve(process.cwd(), "src/lib/golden-quiz.ts"),
  "utf8",
);
const generation = await readFile(
  resolve(process.cwd(), "src/lib/server/golden-quiz-generation.ts"),
  "utf8",
);
const apiRoute = await readFile(
  resolve(process.cwd(), "src/routes/api/ai/generate-quiz.ts"),
  "utf8",
);
const listRoute = await readFile(
  resolve(process.cwd(), "src/routes/app.quizzes.tsx"),
  "utf8",
);
const detailRoute = await readFile(
  resolve(process.cwd(), "src/routes/app.quizzes_.$quizId.tsx"),
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
  requireMarker(studio, marker, `Advanced Quiz Studio is missing required behavior: ${marker}`);
}

for (const marker of [
  "GOLDEN_QUIZ_MARKER",
  "correctExplanation",
  "memoryHint",
  "optionRationales",
  "promptTranslation",
  "optionTranslations",
  "formatGoldenQuizFeedback",
  "parseGoldenQuizFeedback",
]) {
  requireMarker(feedback, marker, `Golden quiz feedback format is missing: ${marker}`);
}

for (const marker of [
  "GOLDEN_QUIZ_PROMPT_VERSION",
  "exactly FOUR answer options",
  "plausible, same-category alternatives",
  "why EACH distractor is wrong",
  "memoryHint",
  "optionRationales",
  "promptTranslation",
  "optionTranslations",
  "dominant language of the source material",
  "Use ONLY facts present in SOURCE CHUNKS",
  "formatGoldenQuizFeedback",
]) {
  requireMarker(generation, marker, `Golden quiz AI generation contract is missing: ${marker}`);
}

for (const marker of [
  "export function GoldenQuizExperience",
  "deterministicShuffle",
  "parseGoldenQuizFeedback",
  "hasQuizTranslation",
  "setSelectedOriginalIndex",
  "option.rationale",
  "presented.feedback.memoryHint",
  "border-emerald-500/60",
  "border-red-500/60",
  "store.recordAttempt",
  "<QuizStudio quizId={quizId} />",
  "Показать перевод",
  "Следующий вопрос",
]) {
  requireMarker(experience, marker, `Golden quiz trainer is missing required behavior: ${marker}`);
}

requireMarker(
  apiRoute,
  "runGoldenQuizGeneration",
  "Quiz generation API no longer uses the golden quiz generator.",
);
requireMarker(listRoute, "QuizLibrary", "The active quiz list route no longer uses QuizLibrary.");
for (const marker of [
  'createFileRoute("/app/quizzes_/$quizId")',
  "GoldenQuizExperience",
]) {
  requireMarker(
    detailRoute,
    marker,
    `The non-nested quiz detail route is missing required behavior: ${marker}`,
  );
}

if (failures.length) {
  console.error("Golden quiz and Quiz Studio contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Golden bilingual quiz generation, trainer, routing and advanced editor contract passed.");
