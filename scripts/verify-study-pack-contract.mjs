import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  client,
  server,
  route,
  dialog,
  draftModal,
  continuation,
  editor,
  persistence,
  materialRoute,
  helpers,
  evaluation,
  packageJson,
  checkScript,
  workflow,
  roadmap,
] = await Promise.all([
  read("src/lib/ai.ts"),
  read("src/lib/server/study-pack-generation.ts"),
  read("src/routes/api/ai/generate-study-pack.ts"),
  read("src/components/study-pack-dialog.tsx"),
  read("src/components/ai-draft-modal.tsx"),
  read("src/components/study-pack-continuation.tsx"),
  read("src/components/study-pack-editor.tsx"),
  read("src/lib/study-pack-persistence.ts"),
  read("src/routes/app.materials_.$materialId.tsx"),
  read("src/lib/study-pack.ts"),
  read("scripts/run-study-pack-evals.mjs"),
  read("package.json"),
  read("scripts/check.mjs"),
  read(".github/workflows/ci.yml"),
  read("ROADMAP.md"),
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

for (const marker of ["runStudyPackGeneration", 'createFileRoute("/api/ai/generate-study-pack")']) {
  requireMarker(route, marker, `Study Pack API route is missing: ${marker}`);
}

for (const marker of [
  "StudyPackButton",
  "Подготовить меня по этой лекции",
  "One source → a complete study session",
  "validateStudyPackDraft",
  "persistStudyPack",
  "setSavedResult(result)",
  "StudyPackContinuation",
  "Ничего не сохранится без твоего подтверждения",
]) {
  requireMarker(dialog, marker, `Study Pack review/save flow is missing: ${marker}`);
}

for (const marker of ["savedContent?: ReactNode", 'state === "saved"', "{savedContent}"]) {
  requireMarker(draftModal, marker, `AI saved-state continuation contract is missing: ${marker}`);
}

for (const marker of [
  "StudyPackContinuation",
  "Понять",
  "Вспомнить",
  "Проверить",
  'to="/app/notes/$noteId"',
  'to="/app/flashcards"',
  'to="/app/quizzes/$quizId"',
  "result.noteId",
  "result.quizId",
]) {
  requireMarker(continuation, marker, `Study Pack continuation path is missing: ${marker}`);
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
  "PersistStudyPackResult",
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

for (const marker of [
  "assert.deepEqual(validateStudyPackDraft(validDraft), [])",
  'invalidDraft.questions[0].options = ["same", "same", "third", "fourth"]',
  'assert.ok(validateStudyPackDraft(invalidDraft).includes("question:0"))',
  'assert.deepEqual(collectStudyPackSourceIds(validDraft), ["chunk-a", "chunk-b"])',
  "assert.match(note, /Study route/)",
  "assert.match(note, /does not automatically prove mastery/)",
  "assert.match(copy, /Diagnostic questions/)",
  "assert.match(copy, /Answer: Relevant among retrieved/)",
]) {
  requireMarker(evaluation, marker, `Study Pack evaluation is missing: ${marker}`);
}

for (const marker of ['"eval:study-pack"', '"verify:study-pack-contract"']) {
  requireMarker(packageJson, marker, `package.json is missing: ${marker}`);
}
for (const marker of ["verify:study-pack-contract", "eval:study-pack"]) {
  requireMarker(checkScript, marker, `npm run check is missing: ${marker}`);
}
for (const marker of ["Verify Study Pack contract", "Run Study Pack evaluations"]) {
  requireMarker(workflow, marker, `CI is missing: ${marker}`);
}
for (const marker of ["Phase 6 — Lecture-to-Study-Pack", "P1-012"]) {
  requireMarker(roadmap, marker, `ROADMAP.md is missing Study Pack product intent: ${marker}`);
}

if (failures.length > 0) {
  console.error("Study Pack contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Study Pack trust boundaries, review/save flow, atomic persistence, continuation paths, executable scenarios and CI wiring are present.",
);
