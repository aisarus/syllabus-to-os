import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const studio = await readFile(
  resolve(process.cwd(), "src/components/flashcard-studio.tsx"),
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
  requireMarker(studio, marker, `Flashcard Studio is missing required behavior: ${marker}`);
}

for (const marker of [
  "Nothing is removed without a separate confirmation",
  "Exact source-chunk references remain untouched",
  "Other cards are removed only after confirmation",
]) {
  requireMarker(studio, marker, `Flashcard Studio lost a destructive-action safeguard: ${marker}`);
}

requireMarker(
  route,
  "FlashcardStudio",
  "The active flashcard route no longer uses Flashcard Studio v1.",
);

if (failures.length) {
  console.error("Flashcard Studio contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Flashcard Studio v1 contract passed.");
