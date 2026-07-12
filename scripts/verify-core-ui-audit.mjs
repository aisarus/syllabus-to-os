import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [
  shell,
  dashboard,
  courseRoute,
  courseLibrary,
  materials,
  search,
  data,
  settings,
  notesRoute,
  flashcardsRoute,
  quizzesRoute,
] = await Promise.all([
  read("src/components/app-shell.tsx"),
  read("src/routes/app.dashboard.tsx"),
  read("src/routes/app.courses.tsx"),
  read("src/components/course-library.tsx"),
  read("src/routes/app.materials.tsx"),
  read("src/routes/app.search.tsx"),
  read("src/routes/app.data.tsx"),
  read("src/routes/app.settings.tsx"),
  read("src/routes/app.notes.tsx"),
  read("src/routes/app.flashcards.tsx"),
  read("src/routes/app.quizzes.tsx"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};
const forbidMarker = (content, marker, message) => {
  if (content.includes(marker)) failures.push(message);
};

for (const route of [
  "/app/dashboard",
  "/app/courses",
  "/app/materials",
  "/app/notes",
  "/app/flashcards",
  "/app/quizzes",
  "/app/import-syllabus",
  "/app/search",
  "/app/data",
  "/app/settings",
]) {
  requireMarker(shell, route, `The product shell lost the active route ${route}.`);
}
for (const deferred of [
  "/app/progress",
  "/app/study-session",
  "/app/calendar",
  "/app/assignments",
]) {
  forbidMarker(shell, deferred, `Deferred tracking route leaked into primary navigation: ${deferred}.`);
}

requireMarker(courseRoute, "CourseLibrary", "Courses route no longer uses the content-first library.");
for (const marker of [
  "statusFilter",
  "courseStatusLabel",
  "programId: data.programs[0]",
]) {
  forbidMarker(courseLibrary, marker, `Tracking or hidden course behavior returned: ${marker}.`);
}
for (const marker of [
  "deleteCourseSafely",
  "store.updateMaterial(material.id, { courseId: undefined, topicId: undefined })",
  "store.updateNote(note.id, { courseId: undefined, topicId: undefined })",
  "store.updateCard(card.id, { courseId: undefined, topicId: undefined })",
  "store.updateQuiz(quiz.id, { courseId: undefined, topicId: undefined })",
  "Самый быстрый старт — загрузить силлабус",
  "Статусы прохождения и проценты здесь намеренно не используются",
]) {
  requireMarker(courseLibrary, marker, `Course library is missing a required safe/content-first behavior: ${marker}`);
}

for (const marker of ["intakeFile(file", "intakeText(text", "UploadDialog", "PasteDialog"]) {
  requireMarker(materials, marker, `Materials route lost a real intake action: ${marker}`);
}

requireMarker(
  search,
  'to="/app/notes/$noteId" params={{ noteId: hit.id }}',
  "Note search results no longer open the exact note.",
);
requireMarker(search, "Clear search", "Search no-result state is not actionable.");

for (const marker of [
  "Импорт полностью заменит текстовые данные Lamdan",
  "Import will replace Lamdan text data",
  "importJSON(raw)",
  "clearAllVisualSourceData",
  "store.reset()",
  "Экспортировать текстовые данные пока нечего",
]) {
  requireMarker(data, marker, `Data management lost a required safeguard or explanation: ${marker}`);
}

for (const marker of [
  'type DiagnosticState = "loading" | "ready" | "error"',
  "refreshStatus",
  "Ошибка проверки",
  "AI status check failed",
  "Данные хранятся только в этом браузере",
  "Data stays in this browser",
]) {
  requireMarker(settings, marker, `Settings diagnostics/localization lost required behavior: ${marker}`);
}
forbidMarker(
  settings,
  "Local personal study workspace. Data is stored only in your browser.",
  "Hardcoded English footer returned to settings.",
);

requireMarker(dashboard, "courseWithoutCode", "Dashboard course-code fallback is no longer localized.");
forbidMarker(
  dashboard,
  'course.number || "COURSE"',
  "Dashboard returned to the hardcoded English COURSE fallback.",
);

for (const [name, content, marker] of [
  ["notes", notesRoute, "NotesLibrary"],
  ["flashcards", flashcardsRoute, "FlashcardStudio"],
  ["quizzes", quizzesRoute, "QuizLibrary"],
]) {
  requireMarker(content, marker, `Active ${name} route no longer uses its real editor/library.`);
}

const coreSurface = [dashboard, courseRoute, courseLibrary, materials, search, data, settings].join("\n");
for (const forbidden of ["loadSampleBarIlan", "study streak", "Study streak", "fake progress"]) {
  forbidMarker(coreSurface, forbidden, `Core UI contains forbidden demo/tracking content: ${forbidden}`);
}

if (failures.length) {
  console.error("Core UI audit contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Core UI honesty and actionability contract passed.");
