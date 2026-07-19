import { replaceMaterialChunksWithStableIds } from "./source-integrity.ts";
import {
  getDataSnapshot,
  getPendingWorkspacePersistenceFailure,
  retryPendingWorkspacePersistence,
  setData,
  store,
  uid,
  updateData,
  workspaceStoreTesting,
  type AppData,
  type MaterialChunk,
} from "./store.ts";

/**
 * Removes deleted chunk ids from every entity that can persist source evidence.
 * This is intentionally pure so store-level evaluations can prove the same rule
 * used by the browser application.
 */
export function scrubSourceChunkReferences(data: AppData, chunkIds: Iterable<string>): AppData {
  const removedIds = new Set(chunkIds);
  if (removedIds.size === 0) return data;

  const rewrite = (ids: string[] | undefined): string[] | undefined => {
    if (!ids) return ids;
    const next = Array.from(new Set(ids.filter((id) => !removedIds.has(id))));
    if (next.length === ids.length && next.every((id, index) => id === ids[index])) return ids;
    return next;
  };

  const notes = data.notes.map((note) => {
    const sourceChunkIds = rewrite(note.sourceChunkIds);
    return sourceChunkIds === note.sourceChunkIds ? note : { ...note, sourceChunkIds };
  });
  const flashcards = data.flashcards.map((card) => {
    const sourceChunkIds = rewrite(card.sourceChunkIds);
    return sourceChunkIds === card.sourceChunkIds ? card : { ...card, sourceChunkIds };
  });
  const quizQuestions = data.quizQuestions.map((question) => {
    const sourceChunkIds = rewrite(question.sourceChunkIds);
    return sourceChunkIds === question.sourceChunkIds ? question : { ...question, sourceChunkIds };
  });
  const presentationOutlines = data.presentationOutlines.map((outline) => {
    let changed = false;
    const slides = outline.slides.map((slide) => {
      const sourceChunkIds = rewrite(slide.sourceChunkIds);
      if (sourceChunkIds === slide.sourceChunkIds) return slide;
      changed = true;
      return { ...slide, sourceChunkIds };
    });
    return changed ? { ...outline, slides, updatedAt: Date.now() } : outline;
  });

  return {
    ...data,
    notes,
    flashcards,
    quizQuestions,
    presentationOutlines,
  };
}

function deleteMaterialSafely(id: string): void {
  updateData((data) => {
    const removedChunkIds = data.materialChunks
      .filter((chunk) => chunk.materialId === id)
      .map((chunk) => chunk.id);
    const withoutMaterial: AppData = {
      ...data,
      materials: data.materials.filter((material) => material.id !== id),
      materialChunks: data.materialChunks.filter((chunk) => chunk.materialId !== id),
      materialOutputs: data.materialOutputs.filter((output) => output.materialId !== id),
      notes: data.notes.map((note) =>
        note.materialId === id ? { ...note, materialId: undefined } : note,
      ),
      flashcards: data.flashcards.map((card) =>
        card.materialId === id ? { ...card, materialId: undefined } : card,
      ),
      quizzes: data.quizzes.map((quiz) =>
        quiz.materialId === id ? { ...quiz, materialId: undefined } : quiz,
      ),
      presentationOutlines: data.presentationOutlines.map((outline) =>
        outline.materialId === id ? { ...outline, materialId: undefined } : outline,
      ),
    };
    return scrubSourceChunkReferences(withoutMaterial, removedChunkIds);
  });
}

function deleteMaterialChunkSafely(id: string): void {
  updateData((data) =>
    scrubSourceChunkReferences(
      {
        ...data,
        materialChunks: data.materialChunks.filter((chunk) => chunk.id !== id),
      },
      [id],
    ),
  );
}

function replaceMaterialChunksSafely(
  materialId: string,
  chunks: Array<Omit<MaterialChunk, "id" | "createdAt" | "materialId">>,
): MaterialChunk[] {
  let created: MaterialChunk[] = [];
  updateData((data) => {
    const replacement = replaceMaterialChunksWithStableIds(data, materialId, chunks, () =>
      uid("chk"),
    );
    created = replacement.chunks;
    return replacement.data;
  });
  return created;
}

// `store` is a shared object. Installing these implementations once keeps all
// existing imports source-safe without changing persistence keys or data shape.
store.deleteMaterial = deleteMaterialSafely;
store.deleteMaterialChunk = deleteMaterialChunkSafely;
store.replaceMaterialChunksForMaterial = replaceMaterialChunksSafely;

export {
  getDataSnapshot,
  getPendingWorkspacePersistenceFailure,
  retryPendingWorkspacePersistence,
  setData,
  store,
  updateData,
  workspaceStoreTesting,
};
