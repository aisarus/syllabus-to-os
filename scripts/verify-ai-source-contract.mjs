import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workspacePath = resolve(process.cwd(), "src/components/material-workspace.tsx");
const dialogPath = resolve(process.cwd(), "src/components/ai-generate-dialog.tsx");
const [workspace, dialog] = await Promise.all([
  readFile(workspacePath, "utf8"),
  readFile(dialogPath, "utf8"),
]);

const failures = [];

function requireMarker(content, marker, description) {
  if (!content.includes(marker)) failures.push(description);
}

for (const kind of ["note", "flashcards", "quiz"]) {
  requireMarker(
    workspace,
    `kind="${kind}"`,
    `Material Workspace is missing the ${kind} selected-source action.`,
  );
}

for (const prop of [
  "initialMaterialId={material.id}",
  "initialCourseId={material.courseId}",
  "initialTopicId={material.topicId}",
  "initialChunkIds={selectedChunkIds}",
]) {
  requireMarker(
    workspace,
    prop,
    `Material Workspace no longer passes required AI context: ${prop}`,
  );
}

requireMarker(
  workspace,
  "selectedText.length.toLocaleString()",
  "Material Workspace no longer shows selected character count.",
);
requireMarker(
  workspace,
  "Сначала выбери хотя бы один фрагмент",
  "Material Workspace no longer explains the empty-source state.",
);
requireMarker(
  dialog,
  "const selectedChunks = chunks.filter((c) => selected.includes(c.id));",
  "AI dialog no longer validates selected IDs against current material chunks.",
);
requireMarker(
  dialog,
  "if (selected.length === 0)",
  "AI dialog no longer blocks an empty source selection.",
);
requireMarker(
  dialog,
  "const overLimit = totalChars > 20_000;",
  "AI dialog no longer enforces the selected-source character limit.",
);
requireMarker(
  dialog,
  "sourceChunkIds: selected",
  "AI save flow no longer persists selected source chunk IDs.",
);
requireMarker(
  dialog,
  "sourceChunkIds: c.sourceChunkIds?.length ? c.sourceChunkIds : selected",
  "Flashcard save flow no longer preserves source chunk IDs.",
);
requireMarker(
  dialog,
  "sourceChunkIds: qq.sourceChunkIds?.length ? qq.sourceChunkIds : selected",
  "Quiz save flow no longer preserves source chunk IDs.",
);
requireMarker(
  dialog,
  "store.recordOutput({ materialId: material.id, type: \"note\"",
  "Note generation no longer records material output history.",
);
requireMarker(
  dialog,
  "store.recordOutput({ materialId: material.id, type: \"flashcards\"",
  "Flashcard generation no longer records material output history.",
);
requireMarker(
  dialog,
  "store.recordOutput({ materialId: material.id, type: \"quiz\"",
  "Quiz generation no longer records material output history.",
);

if (failures.length > 0) {
  console.error("Selected-source AI contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Selected-source AI contract verification passed.");
