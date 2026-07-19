import { replaceMaterialChunksWithStableIds } from "./source-integrity.ts";
import type { AppData, MaterialChunk } from "./store-types.ts";

export interface WorkspaceChunkReplacement {
  data: AppData;
  chunks: MaterialChunk[];
}

/** Removes deleted chunk ids from every entity that can persist source evidence. */
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

  return { ...data, notes, flashcards, quizQuestions, presentationOutlines };
}

export function deleteMaterialFromWorkspace(data: AppData, materialId: string): AppData {
  const removedChunkIds = data.materialChunks
    .filter((chunk) => chunk.materialId === materialId)
    .map((chunk) => chunk.id);
  const withoutMaterial: AppData = {
    ...data,
    materials: data.materials.filter((material) => material.id !== materialId),
    materialChunks: data.materialChunks.filter((chunk) => chunk.materialId !== materialId),
    materialOutputs: data.materialOutputs.filter((output) => output.materialId !== materialId),
    notes: data.notes.map((note) =>
      note.materialId === materialId ? { ...note, materialId: undefined } : note,
    ),
    flashcards: data.flashcards.map((card) =>
      card.materialId === materialId ? { ...card, materialId: undefined } : card,
    ),
    quizzes: data.quizzes.map((quiz) =>
      quiz.materialId === materialId ? { ...quiz, materialId: undefined } : quiz,
    ),
    presentationOutlines: data.presentationOutlines.map((outline) =>
      outline.materialId === materialId ? { ...outline, materialId: undefined } : outline,
    ),
  };
  return scrubSourceChunkReferences(withoutMaterial, removedChunkIds);
}

export function deleteMaterialChunkFromWorkspace(data: AppData, chunkId: string): AppData {
  return scrubSourceChunkReferences(
    {
      ...data,
      materialChunks: data.materialChunks.filter((chunk) => chunk.id !== chunkId),
    },
    [chunkId],
  );
}

export function replaceMaterialChunksInWorkspace(
  data: AppData,
  materialId: string,
  chunks: Array<Omit<MaterialChunk, "id" | "createdAt" | "materialId">>,
  createId: () => string,
): WorkspaceChunkReplacement {
  const replacement = replaceMaterialChunksWithStableIds(data, materialId, chunks, createId);
  return { data: replacement.data, chunks: replacement.chunks };
}
