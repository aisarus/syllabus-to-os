import type { AppData } from "./store.ts";

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
