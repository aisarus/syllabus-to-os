import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const editor = await readFile(
  resolve(process.cwd(), "src/components/note-editor-workspace.tsx"),
  "utf8",
);
const library = await readFile(resolve(process.cwd(), "src/components/notes-library.tsx"), "utf8");
const listRoute = await readFile(resolve(process.cwd(), "src/routes/app.notes.tsx"), "utf8");
const detailRoute = await readFile(
  resolve(process.cwd(), "src/routes/app.notes.$noteId.tsx"),
  "utf8",
);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  'type SaveState = "saved" | "unsaved" | "saving" | "error"',
  "setTimeout(() => persistDraft(draft), 700)",
  'window.addEventListener("beforeunload"',
  'dir="auto"',
  "MarkdownToolbar",
  "sourceChunkIds",
  "findMissingSourceSections",
  "downloadMarkdown",
  'setConvertMode("flashcard")',
  'setConvertMode("quiz")',
  "store.createCard",
  "store.addQuestion",
]) {
  requireMarker(editor, marker, `Notes editor is missing required behavior: ${marker}`);
}

for (const marker of [
  "courseFilter",
  "materialFilter",
  "tagFilter",
  "duplicate(note)",
  "MergeNotesDialog",
  "Original notes are not changed or deleted",
  "sourceChunkIds: Array.from(new Set",
]) {
  requireMarker(library, marker, `Notes library is missing required behavior: ${marker}`);
}

requireMarker(
  listRoute,
  "NotesLibrary",
  "The active notes list route no longer uses NotesLibrary.",
);
requireMarker(
  detailRoute,
  "NoteEditorWorkspace",
  "The active note detail route no longer uses NoteEditorWorkspace.",
);

if (failures.length) {
  console.error("Notes editor contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Reliable Notes editor contract passed.");
