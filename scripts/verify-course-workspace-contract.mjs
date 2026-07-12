import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workspace = await readFile(
  resolve(process.cwd(), "src/components/course-workspace.tsx"),
  "utf8",
);
const route = await readFile(
  resolve(process.cwd(), "src/routes/app.courses.$courseId.tsx"),
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

for (const kind of ["note", "flashcards", "quiz"]) {
  requireMarker(
    workspace,
    `kind="${kind}"`,
    `Course Workspace is missing the explicit ${kind} AI action.`,
  );
}

requireMarker(
  route,
  "CourseWorkspace",
  "The active course route no longer uses Course Workspace v1.",
);

if (failures.length) {
  console.error("Course Workspace contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Course Workspace v1 contract passed.");
