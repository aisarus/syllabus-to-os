import { uid, updateData, type AppData, type MaterialChunk } from "./store";

export interface ChunkReferenceCount {
  notes: number;
  flashcards: number;
  quizQuestions: number;
  slides: number;
  total: number;
}

export interface SplitChunkResult {
  originalChunkId: string;
  newChunkId: string;
}

export interface MergeChunkResult {
  keptChunkId: string;
  removedChunkId: string;
}

export function countChunkReferences(data: AppData, chunkId: string): ChunkReferenceCount {
  const notes = data.notes.filter((item) => item.sourceChunkIds?.includes(chunkId)).length;
  const flashcards = data.flashcards.filter((item) =>
    item.sourceChunkIds?.includes(chunkId),
  ).length;
  const quizQuestions = data.quizQuestions.filter((item) =>
    item.sourceChunkIds?.includes(chunkId),
  ).length;
  const slides = data.presentationOutlines.reduce(
    (count, outline) =>
      count + outline.slides.filter((slide) => slide.sourceChunkIds?.includes(chunkId)).length,
    0,
  );

  return {
    notes,
    flashcards,
    quizQuestions,
    slides,
    total: notes + flashcards + quizQuestions + slides,
  };
}

export function editMaterialChunk(
  chunkId: string,
  patch: Pick<Partial<MaterialChunk>, "title" | "text">,
): boolean {
  let changed = false;

  updateData((data) => {
    const chunk = data.materialChunks.find((item) => item.id === chunkId);
    if (!chunk) return data;

    changed = true;
    const materialChunks = data.materialChunks.map((item) =>
      item.id === chunkId
        ? {
            ...item,
            ...patch,
            title: patch.title?.trim() || undefined,
          }
        : item,
    );

    return syncMaterialProjection({ ...data, materialChunks }, chunk.materialId);
  });

  return changed;
}

export function splitMaterialChunk(chunkId: string, offset: number): SplitChunkResult | null {
  let result: SplitChunkResult | null = null;

  updateData((data) => {
    const chunk = data.materialChunks.find((item) => item.id === chunkId);
    if (!chunk || offset <= 0 || offset >= chunk.text.length) return data;

    const firstText = chunk.text.slice(0, offset).trimEnd();
    const secondText = chunk.text.slice(offset).trimStart();
    if (!firstText || !secondText) return data;

    const newChunkId = uid("chk");
    const newChunk: MaterialChunk = {
      ...chunk,
      id: newChunkId,
      title: chunk.title ? `${chunk.title} — 2` : undefined,
      text: secondText,
      order: chunk.order + 1,
      createdAt: Date.now(),
    };

    const materialChunks = data.materialChunks.map((item) => {
      if (item.id === chunk.id) {
        return {
          ...item,
          title: item.title ? `${item.title} — 1` : item.title,
          text: firstText,
        };
      }
      if (item.materialId === chunk.materialId && item.order > chunk.order) {
        return { ...item, order: item.order + 1 };
      }
      return item;
    });

    const withChunk = {
      ...data,
      materialChunks: normalizeMaterialChunkOrders([...materialChunks, newChunk], chunk.materialId),
    };
    const withReferences = rewriteChunkReferences(
      withChunk,
      new Map([[chunk.id, [chunk.id, newChunkId]]]),
    );
    result = { originalChunkId: chunk.id, newChunkId };
    return syncMaterialProjection(withReferences, chunk.materialId);
  });

  return result;
}

export function mergeMaterialChunkWithNext(chunkId: string): MergeChunkResult | null {
  let result: MergeChunkResult | null = null;

  updateData((data) => {
    const chunk = data.materialChunks.find((item) => item.id === chunkId);
    if (!chunk) return data;

    const siblings = data.materialChunks
      .filter((item) => item.materialId === chunk.materialId)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    const index = siblings.findIndex((item) => item.id === chunk.id);
    const next = siblings[index + 1];
    if (!next) return data;

    const mergedText = [chunk.text.trimEnd(), next.text.trimStart()].filter(Boolean).join("\n\n");
    const mergedChunk: MaterialChunk = {
      ...chunk,
      title: chunk.title || next.title,
      text: mergedText,
      pageNumber:
        chunk.pageNumber === next.pageNumber
          ? chunk.pageNumber
          : (chunk.pageNumber ?? next.pageNumber),
      section: chunk.section === next.section ? chunk.section : (chunk.section ?? next.section),
    };

    const materialChunks = normalizeMaterialChunkOrders(
      data.materialChunks
        .filter((item) => item.id !== next.id)
        .map((item) => (item.id === chunk.id ? mergedChunk : item)),
      chunk.materialId,
    );
    const withReferences = rewriteChunkReferences(
      { ...data, materialChunks },
      new Map([[next.id, [chunk.id]]]),
    );

    result = { keptChunkId: chunk.id, removedChunkId: next.id };
    return syncMaterialProjection(withReferences, chunk.materialId);
  });

  return result;
}

export function moveMaterialChunk(chunkId: string, direction: "up" | "down"): boolean {
  let changed = false;

  updateData((data) => {
    const chunk = data.materialChunks.find((item) => item.id === chunkId);
    if (!chunk) return data;

    const siblings = data.materialChunks
      .filter((item) => item.materialId === chunk.materialId)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    const index = siblings.findIndex((item) => item.id === chunk.id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const target = siblings[targetIndex];
    if (!target) return data;

    changed = true;
    const materialChunks = data.materialChunks.map((item) => {
      if (item.id === chunk.id) return { ...item, order: target.order };
      if (item.id === target.id) return { ...item, order: chunk.order };
      return item;
    });

    return syncMaterialProjection(
      {
        ...data,
        materialChunks: normalizeMaterialChunkOrders(materialChunks, chunk.materialId),
      },
      chunk.materialId,
    );
  });

  return changed;
}

export function deleteMaterialChunkSafely(chunkId: string): boolean {
  let changed = false;

  updateData((data) => {
    const chunk = data.materialChunks.find((item) => item.id === chunkId);
    if (!chunk) return data;

    changed = true;
    const materialChunks = normalizeMaterialChunkOrders(
      data.materialChunks.filter((item) => item.id !== chunk.id),
      chunk.materialId,
    );
    const withReferences = rewriteChunkReferences(
      { ...data, materialChunks },
      new Map([[chunk.id, []]]),
    );

    return syncMaterialProjection(withReferences, chunk.materialId);
  });

  return changed;
}

function normalizeMaterialChunkOrders(
  chunks: MaterialChunk[],
  materialId: string,
): MaterialChunk[] {
  const normalized = new Map(
    chunks
      .filter((item) => item.materialId === materialId)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
      .map((item, order) => [item.id, { ...item, order }]),
  );

  return chunks.map((item) => normalized.get(item.id) ?? item);
}

function rewriteChunkReferences(data: AppData, replacements: Map<string, string[]>): AppData {
  const rewrite = (ids: string[] | undefined): string[] | undefined => {
    if (!ids) return ids;
    const next = ids.flatMap((id) => replacements.get(id) ?? [id]);
    return Array.from(new Set(next));
  };

  return {
    ...data,
    notes: data.notes.map((item) => ({ ...item, sourceChunkIds: rewrite(item.sourceChunkIds) })),
    flashcards: data.flashcards.map((item) => ({
      ...item,
      sourceChunkIds: rewrite(item.sourceChunkIds),
    })),
    quizQuestions: data.quizQuestions.map((item) => ({
      ...item,
      sourceChunkIds: rewrite(item.sourceChunkIds),
    })),
    presentationOutlines: data.presentationOutlines.map((outline) => ({
      ...outline,
      slides: outline.slides.map((slide) => ({
        ...slide,
        sourceChunkIds: rewrite(slide.sourceChunkIds),
      })),
    })),
  };
}

function syncMaterialProjection(data: AppData, materialId: string): AppData {
  const rawText = data.materialChunks
    .filter((item) => item.materialId === materialId)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join("\n\n");

  return {
    ...data,
    materials: data.materials.map((material) =>
      material.id === materialId
        ? {
            ...material,
            rawText,
            charCount: rawText.length,
            wordCount: countWords(rawText),
            updatedAt: Date.now(),
          }
        : material,
    ),
  };
}

function countWords(value: string): number {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}
