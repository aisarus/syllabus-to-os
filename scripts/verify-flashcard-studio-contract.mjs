import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const studio = await readFile(
  resolve(process.cwd(), "src/components/flashcard-studio.tsx"),
  "utf8",
);
const experience = await readFile(
  resolve(process.cwd(), "src/components/flashcard-experience.tsx"),
  "utf8",
);
const route = await readFile(
  resolve(process.cwd(), "src/routes/app.flashcards.tsx"),
  "utf8",
);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "courseFilter",
  "topicFilter",
  "materialFilter",
  "statusFilter",
  "selectedIds",
  "setBulkDeleteOpen(true)",
  "setBulkRelinkOpen(true)",
  "store.updateCard(card.id, { front:",
  "store.updateCard(card.id, { back:",
  "detectDuplicateGroups",
  "DuplicateMergeDialog",
  "sourceChunkIds = Array.from(new Set",
  "store.reviewCard(card.id, quality)",
  "CSV import preview",
  "downloadFile(\"lamdan-flashcards.csv\"",
]) {
  requireMarker(studio, marker, `Flashcard management is missing required behavior: ${marker}`);
}

for (const marker of [
  "Nothing is removed without a separate confirmation",
  "Exact source-chunk references remain untouched",
  "Other cards are removed only after confirmation",
]) {
  requireMarker(studio, marker, `Flashcard management lost a destructive-action safeguard: ${marker}`);
}

for (const marker of [
  "export function FlashcardExperience",
  "QuizletFlipCard",
  'perspective: "1400px"',
  'transformStyle: "preserve-3d"',
  'transform: flipped ? "rotateY(180deg)"',
  'backfaceVisibility: "hidden"',
  "store.reviewCard(card.id, quality)",
  'setView("manage")',
  "<FlashcardStudio />",
  "Перемешать",
  "Повторить",
  "Знаю",
]) {
  requireMarker(experience, marker, `Two-sided flashcard experience is missing: ${marker}`);
}

requireMarker(
  route,
  "FlashcardExperience",
  "The active flashcard route no longer opens the two-sided study deck.",
);

if (failures.length) {
  console.error("Flashcard experience contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Quizlet-style two-sided flashcards and management contract passed.");
