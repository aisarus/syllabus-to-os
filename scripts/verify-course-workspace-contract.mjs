import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workspace = await readFile(
  resolve(process.cwd(), "src/components/course-workspace.tsx"),
  "utf8",
);
const route = await readFile(
  resolve(process.cwd(), "src/routes/app.courses_.$courseId.tsx"),
  "utf8",
);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};
const requirePattern = (content, pattern, message) => {
  if (!pattern.test(content)) failures.push(message);
};

for (const marker of [
  "uncoveredTopics",
  "topicMaterials",
  "unassignedMaterials",
  "intakeFile(file",
  "attachExistingMaterial",
  "store.updateMaterial(material.id, { topicId:",
  "store.updateNote(note.id, { topicId",
  "store.updateCard(card.id, { topicId",
  "store.updateQuiz(quiz.id, { topicId",
  "initialChunkIds={selectedChunkIds}",
  "Lamdan ничего не включает молча",
  "без процентов, таймеров и искусственного прогресса",
]) {
  requireMarker(workspace, marker, `Course Workspace is missing required behavior: ${marker}`);
}

for (const [pattern, message] of [
  [
    /<Input(?=[^>]*\bvalue=\{newTopic\})(?=[^>]*\baria-label=\{\s*isRu\s*\?\s*"Название новой темы"\s*:\s*"New topic title"\s*\})[^>]*\/?\s*>/,
    "Course Workspace topic creation input is missing its localized purpose-specific label.",
  ],
  [
    /<SelectTrigger(?=[^>]*\baria-label=\{\s*isRu\s*\?\s*"Тема для загружаемого материала"\s*:\s*"Topic for uploaded material"\s*\})[^>]*>/,
    "Course Workspace upload-topic selector is missing its localized purpose-specific label.",
  ],
  [
    /<strong(?=[^>]*\bdir="auto")(?=[^>]*\bclassName="[^"]*\bblock\b[^"]*\btruncate\b[^"]*")[^>]*>\s*\{chunk\.title/,
    "Course Workspace extracted chunk title is missing its automatic direction boundary.",
  ],
  [
    /<span(?=[^>]*\bdir="auto")(?=[^>]*\bclassName="[^"]*\bline-clamp-2\b[^"]*")[^>]*>\s*\{chunk\.text\}/,
    "Course Workspace extracted chunk text is missing its automatic direction boundary.",
  ],
  [
    /<strong(?=[^>]*\bdir="auto")(?=[^>]*\bclassName="[^"]*\btruncate\b[^"]*\bhover:text-primary\b[^"]*")[^>]*>\s*\{material\.title\}/,
    "Course Workspace linked material title is missing its automatic direction boundary.",
  ],
]) {
  requirePattern(workspace, pattern, message);
}

for (const kind of ["note", "flashcards", "quiz"]) {
  requireMarker(
    workspace,
    `kind="${kind}"`,
    `Course Workspace is missing the explicit ${kind} AI action.`,
  );
}

for (const marker of ['createFileRoute("/app/courses_/$courseId")', "CourseWorkspace"]) {
  requireMarker(
    route,
    marker,
    `The non-nested course detail route is missing required behavior: ${marker}`,
  );
}

if (failures.length) {
  console.error("Course Workspace contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Course Workspace v1 and non-nested detail routing contract passed.");
