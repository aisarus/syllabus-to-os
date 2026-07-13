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
const forbidMarker = (content, marker, message) => {
  if (content.includes(marker)) failures.push(message);
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
  'downloadFile("lamdan-flashcards.csv"',
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
  "StableFlashcard",
  "const startReview = () =>",
  'setReviewOnly(true)',
  'setView("study")',
  '<RotateCcw className="h-4 w-4 me-1" />',
  '"Повторить"',
  "dueCards.length",
  "store.reviewCard(card.id, quality)",
  'setView("manage")',
  "<FlashcardStudio />",
  "Перемешать",
  "Знаю",
  "min-h-[360px]",
  "overflow-y-auto",
]) {
  requireMarker(experience, marker, `Two-sided flashcard experience is missing: ${marker}`);
}

for (const forbidden of [
  'perspective: "1400px"',
  'transformStyle: "preserve-3d"',
  'rotateY(180deg)',
  'backfaceVisibility: "hidden"',
  "absolute inset-0",
]) {
  forbidMarker(
    experience,
    forbidden,
    `Flashcard rendering returned to the broken layered 3D implementation: ${forbidden}`,
  );
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

console.log("Stable two-sided flashcards, persistent review action and management contract passed.");
