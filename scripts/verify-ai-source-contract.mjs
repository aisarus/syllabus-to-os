import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const paths = {
  workspace: resolve(process.cwd(), "src/components/material-workspace.tsx"),
  dialog: resolve(process.cwd(), "src/components/ai-generate-dialog-impl.tsx"),
  modal: resolve(process.cwd(), "src/components/ai-draft-modal.tsx"),
  client: resolve(process.cwd(), "src/lib/ai.ts"),
  server: resolve(process.cwd(), "src/lib/server/ai-generation.ts"),
};
const [workspace, dialog, modal, client, server] = await Promise.all([
  readFile(paths.workspace, "utf8"),
  readFile(paths.dialog, "utf8"),
  readFile(paths.modal, "utf8"),
  readFile(paths.client, "utf8"),
  readFile(paths.server, "utf8"),
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
  "if (selected.length === 0 || selectedChunks.length === 0)",
  "AI dialog no longer blocks an empty or stale source selection.",
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
  "sourceChunkIds: card.sourceChunkIds?.length ? card.sourceChunkIds : selected",
  "Flashcard save flow no longer preserves source chunk IDs.",
);
requireMarker(
  dialog,
  "sourceChunkIds: question.sourceChunkIds?.length",
  "Quiz save flow no longer preserves source chunk IDs.",
);
requireMarker(
  dialog,
  'store.recordOutput({ materialId: material.id, type: "note"',
  "Note generation no longer records material output history.",
);
requireMarker(
  dialog,
  'store.recordOutput({ materialId: material.id, type: "flashcards"',
  "Flashcard generation no longer records material output history.",
);
requireMarker(
  dialog,
  'store.recordOutput({ materialId: material.id, type: "quiz"',
  "Quiz generation no longer records material output history.",
);

for (const marker of [
  'state !== "ready" || saveLocked || !draftValid',
  'setState("saved")',
  "dirty={dirty}",
  "onRegenerateItem={regenerateCard}",
  "onRegenerateItem={regenerateQuestion}",
]) {
  requireMarker(dialog, marker, `AI draft review contract is missing required behavior: ${marker}`);
}
requireMarker(
  modal,
  "Close and discard the unsaved draft changes?",
  "AI draft modal no longer protects unsaved changes.",
);
requireMarker(
  modal,
  'export type AIDraftState = "idle" | "loading" | "error" | "ready" | "saved";',
  "AI draft modal no longer exposes an explicit saved state.",
);

for (const marker of [
  'export const AI_PROMPT_VERSION = "study-grounding-v1"',
  "sourceChunkIds may contain ONLY ids listed here",
  "Do not invent facts, citations, dates, formulas, names, numbers, source ids, or page numbers",
  "notFoundInSources=true",
  "rejectedSourceChunkIds",
  "uncitedItemCount",
  "validateChunkIds",
]) {
  requireMarker(server, marker, `Server AI trust contract is missing required behavior: ${marker}`);
}

for (const marker of [
  "export interface AITrustMetadata",
  "promptVersion: string",
  "rejectedSourceChunkIds: string[]",
  "uncitedItemCount: number",
  "notFoundInSources?: boolean",
]) {
  requireMarker(client, marker, `Client AI trust contract is missing required shape: ${marker}`);
}

for (const marker of [
  "Source review required",
  "Source references validated",
  "Unknown IDs removed",
  "Uncited items",
  "The selected sources did not contain enough information",
  "findDraftMetadata",
]) {
  requireMarker(modal, marker, `Draft trust UI is missing required diagnostic behavior: ${marker}`);
}

if (failures.length > 0) {
  console.error("Selected-source AI contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Selected-source AI, draft review, and citation trust contracts passed.");
