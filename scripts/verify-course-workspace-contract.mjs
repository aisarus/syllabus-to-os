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

for (const [marker, message] of [
  [
    'aria-label={isRu ? "Название новой темы" : "New topic title"}',
    "Course Workspace topic creation input is missing its localized purpose-specific label.",
  ],
  [
    'aria-label={isRu ? "Тема для загружаемого материала" : "Topic for uploaded material"}',
    "Course Workspace upload-topic selector is missing its localized purpose-specific label.",
  ],
  [
    '<strong dir="auto" className="block truncate">',
    "Course Workspace extracted chunk title is missing its automatic direction boundary.",
  ],
  [
    '<span dir="auto" className="mt-1 block line-clamp-2 text-muted-foreground">',
    "Course Workspace extracted chunk text is missing its automatic direction boundary.",
  ],
  [
    '<strong dir="auto" className="block truncate text-sm hover:text-primary">',
    "Course Workspace linked material title is missing its automatic direction boundary.",
  ],
]) {
  requireMarker(workspace, marker, message);
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
