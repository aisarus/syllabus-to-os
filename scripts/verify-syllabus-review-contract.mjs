import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const files = {
  review: resolve(process.cwd(), "src/components/syllabus-review-workspace.tsx"),
  intake: resolve(process.cwd(), "src/lib/syllabus-review.ts"),
  route: resolve(process.cwd(), "src/routes/app.import-syllabus.tsx"),
};

const [review, intake, route] = await Promise.all(
  Object.values(files).map((file) => readFile(file, "utf8")),
);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [".pdf", ".docx", ".xlsx", ".csv", ".txt"]) {
  requireMarker(review, marker, `Syllabus file intake no longer advertises ${marker}.`);
}

for (const marker of [
  "ingestSyllabusFile",
  "ingestPastedSyllabus",
  "previousImportMatches",
  "findDuplicateCourse",
  "setConfirmOpen(true)",
  "store.replaceMaterialChunksForMaterial",
  'tags: ["syllabus-review"]',
  "normalizedTitle(topic.title)",
]) {
  requireMarker(review, marker, `Syllabus review flow is missing required behavior: ${marker}`);
}

for (const marker of [
  "readings: string[]",
  "assignments: string[]",
  "exams: string[]",
  "grading: string[]",
  "fieldConfidence",
  "parseWeeklyTopic",
  "ingestFile(file)",
  "parseWorkbookToSyllabusDraft",
]) {
  requireMarker(intake, marker, `Syllabus review model is missing required behavior: ${marker}`);
}

requireMarker(
  review,
  "Only this button changes data",
  "Explicit confirmation copy was removed from syllabus review.",
);
requireMarker(
  review,
  "topics merge without deleting existing ones",
  "Duplicate-safe topic merge explanation was removed.",
);
requireMarker(
  route,
  "SyllabusReviewWorkspace",
  "Active syllabus route no longer uses the review workspace.",
);

if (failures.length) {
  console.error("Syllabus review contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Syllabus review and confirmation contract passed.");
