import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  client,
  server,
  route,
  dialog,
  editor,
  persistence,
  materialRoute,
  helpers,
  roadmap,
  tasks,
  status,
] = await Promise.all([
  read("src/lib/ai.ts"),
  read("src/lib/server/study-pack-generation.ts"),
  read("src/routes/api/ai/generate-study-pack.ts"),
  read("src/components/study-pack-dialog.tsx"),
  read("src/components/study-pack-editor.tsx"),
  read("src/lib/study-pack-persistence.ts"),
  read("src/routes/app.materials_.$materialId.tsx"),
  read("src/lib/study-pack.ts"),
  read("ROADMAP.md"),
  read("TASKS.md"),
  read("STATUS.md"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  "StudyPackDraft",
  "orientationSourceChunkIds",
  "StudyPackStepDraft",
  "generateStudyPackDraft",
  '"/api/ai/generate-study-pack"',
]) {
  requireMarker(client, marker, `Client AI contract is missing: ${marker}`);
}

for (const marker of [
  "Use ONLY facts present in SOURCE CHUNKS",
  "Never use model memory to fill a gap",
  "Every factual section, step, term, card and question",
  "notFoundInSources=true",
  "allowed source ids only",
  "uncitedItemCount",
  "rejectedSourceChunkIds",
  "exactly four unique options",
  "Do not claim that completing the pack equals mastery",
  "orientationSourceChunkIds = tracker.cite",
]) {
  requireMarker(server, marker, `Study Pack trust contract is missing: ${marker}`);
}

for (const marker of [
  "runStudyPackGeneration",
  'createFileRoute("/api/ai/generate-study-pack")',
]) {
  requireMarker(route, marker, `Study Pack API route is missing: ${marker}`);
}

for (const marker of [
  "StudyPackButton",
  "Подготовить меня по этой лекции",
  "One source → a complete study session",
  "validateStudyPackDraft",
  "persistStudyPack",
  "Ничего не сохранится без твоего подтверждения",
]) {
  requireMarker(dialog, marker, `Study Pack review/save flow is missing: ${marker}`);
}

for (const marker of [
  "StudyPackEditor",
  "Диагностические вопросы",
  "question.options.map",
  "correctIndex",
]) {
  requireMarker(editor, marker, `Study Pack editor is missing: ${marker}`);
}

for (const marker of [
  "persistStudyPack",
  "updateData((data)",
  "notes: [note, ...data.notes]",
  "flashcards: [...data.flashcards, ...flashcards]",
  "quizQuestions: [...data.quizQuestions, ...questions]",
  "materialOutputs: [...outputs, ...data.materialOutputs]",
]) {
  requireMarker(persistence, marker, `Atomic Study Pack persistence is missing: ${marker}`);
}

requireMarker(
  materialRoute,
  "<StudyPackButton",
  "Material detail does not expose the Study Pack action.",
);

for (const marker of [
  "collectStudyPackSourceIds",
  "validateStudyPackDraft",
  "Completing the route does not automatically prove mastery",
]) {
  requireMarker(helpers, marker, `Study Pack helper contract is missing: ${marker}`);
}

for (const [content, marker, file] of [
  [roadmap, "Phase 6 — Lecture-to-Study-Pack", "ROADMAP.md"],
  [tasks, "P1-012 — Lecture-to-Study-Pack", "TASKS.md"],
  [status, "P1-012", "STATUS.md"],
]) {
  requireMarker(content, marker, `${file} is missing Study Pack status marker: ${marker}`);
}

if (failures.length > 0) {
  console.error("Study Pack contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Study Pack contract passed.");
