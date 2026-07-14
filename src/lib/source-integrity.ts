import type { AppData, MaterialChunk } from "./store";

export type IncomingMaterialChunk = Omit<MaterialChunk, "id" | "createdAt" | "materialId">;

export interface ChunkReplacementResult {
  data: AppData;
  chunks: MaterialChunk[];
  preservedIds: number;
  removedIds: string[];
}

export interface SourceReferenceRepairResult {
  data: AppData;
  changed: boolean;
  remappedIds: Record<string, string>;
  removedReferenceCount: number;
}

interface ChunkPair {
  oldId: string;
  newId: string;
}

/**
 * Replaces every chunk for one material while preserving stable ids whenever the
 * new chunk still represents the same page/region/order. References to chunks
 * that truly disappeared are removed from notes, cards, quiz questions and
 * presentation slides in the same state update.
 */
export function replaceMaterialChunksWithStableIds(
  data: AppData,
  materialId: string,
  incoming: IncomingMaterialChunk[],
  createId: () => string,
  now = Date.now(),
): ChunkReplacementResult {
  const existing = data.materialChunks
    .filter((chunk) => chunk.materialId === materialId)
    .slice()
    .sort(compareChunks);
  const provisional = incoming.map((chunk, index) => ({
    ...chunk,
    order: chunk.order ?? index,
    materialId,
    id: `__incoming_${index}`,
    createdAt: now,
  })) satisfies MaterialChunk[];

  const pairs = pairChunks(existing, provisional);
  const oldIdByProvisionalId = new Map(pairs.map((pair) => [pair.newId, pair.oldId]));
  const existingById = new Map(existing.map((chunk) => [chunk.id, chunk]));
  let preservedIds = 0;

  const chunks = provisional.map((chunk) => {
    const preservedId = oldIdByProvisionalId.get(chunk.id);
    const previous = preservedId ? existingById.get(preservedId) : undefined;
    if (preservedId) preservedIds += 1;
    return {
      ...chunk,
      id: preservedId ?? createId(),
      createdAt: previous?.createdAt ?? now,
    };
  });

  const retainedIds = new Set(chunks.map((chunk) => chunk.id));
  const removedIds = existing
    .filter((chunk) => !retainedIds.has(chunk.id))
    .map((chunk) => chunk.id);
  const removedSet = new Set(removedIds);
  const nextData: AppData = {
    ...data,
    materialChunks: [
      ...data.materialChunks.filter((chunk) => chunk.materialId !== materialId),
      ...chunks,
    ],
  };

  return {
    data: removedIds.length > 0 ? repairReferences(nextData, new Map(), removedSet).data : nextData,
    chunks,
    preservedIds,
    removedIds,
  };
}

/**
 * Repairs references after legacy code has already replaced chunk ids. It uses
 * the previous state to map removed chunks to their most likely replacements,
 * then drops only references that no longer have any valid target.
 */
export function repairDanglingSourceReferences(
  previous: AppData,
  current: AppData,
): SourceReferenceRepairResult {
  const currentIds = new Set(current.materialChunks.map((chunk) => chunk.id));
  const previousIds = new Set(previous.materialChunks.map((chunk) => chunk.id));
  const remap = new Map<string, string>();
  const materialIds = new Set([
    ...previous.materialChunks.map((chunk) => chunk.materialId),
    ...current.materialChunks.map((chunk) => chunk.materialId),
  ]);

  for (const materialId of materialIds) {
    const removed = previous.materialChunks
      .filter((chunk) => chunk.materialId === materialId && !currentIds.has(chunk.id))
      .sort(compareChunks);
    const added = current.materialChunks
      .filter((chunk) => chunk.materialId === materialId && !previousIds.has(chunk.id))
      .sort(compareChunks);
    for (const pair of pairChunks(removed, added)) remap.set(pair.oldId, pair.newId);
  }

  const invalidIds = new Set<string>();
  for (const id of collectReferencedChunkIds(current)) {
    if (!currentIds.has(id) && !remap.has(id)) invalidIds.add(id);
  }

  const repaired = repairReferences(current, remap, invalidIds);
  return {
    data: repaired.data,
    changed: repaired.changed,
    remappedIds: Object.fromEntries(remap),
    removedReferenceCount: repaired.removedReferenceCount,
  };
}

function repairReferences(
  data: AppData,
  remap: Map<string, string>,
  invalidIds: Set<string>,
): { data: AppData; changed: boolean; removedReferenceCount: number } {
  let changed = false;
  let removedReferenceCount = 0;

  const fix = (ids: string[] | undefined): string[] | undefined => {
    if (!ids) return ids;
    const next: string[] = [];
    for (const id of ids) {
      const mapped = remap.get(id);
      if (mapped) {
        if (!next.includes(mapped)) next.push(mapped);
        if (mapped !== id) changed = true;
        continue;
      }
      if (invalidIds.has(id)) {
        changed = true;
        removedReferenceCount += 1;
        continue;
      }
      if (!next.includes(id)) next.push(id);
      else changed = true;
    }
    return arraysEqual(ids, next) ? ids : next;
  };

  const notes = data.notes.map((note) => {
    const sourceChunkIds = fix(note.sourceChunkIds);
    return sourceChunkIds === note.sourceChunkIds ? note : { ...note, sourceChunkIds };
  });
  const flashcards = data.flashcards.map((card) => {
    const sourceChunkIds = fix(card.sourceChunkIds);
    return sourceChunkIds === card.sourceChunkIds ? card : { ...card, sourceChunkIds };
  });
  const quizQuestions = data.quizQuestions.map((question) => {
    const sourceChunkIds = fix(question.sourceChunkIds);
    return sourceChunkIds === question.sourceChunkIds ? question : { ...question, sourceChunkIds };
  });
  const presentationOutlines = data.presentationOutlines.map((outline) => {
    let outlineChanged = false;
    const slides = outline.slides.map((slide) => {
      const sourceChunkIds = fix(slide.sourceChunkIds);
      if (sourceChunkIds === slide.sourceChunkIds) return slide;
      outlineChanged = true;
      return { ...slide, sourceChunkIds };
    });
    return outlineChanged ? { ...outline, slides, updatedAt: Date.now() } : outline;
  });

  return {
    data: changed ? { ...data, notes, flashcards, quizQuestions, presentationOutlines } : data,
    changed,
    removedReferenceCount,
  };
}

function pairChunks(oldChunks: MaterialChunk[], newChunks: MaterialChunk[]): ChunkPair[] {
  if (oldChunks.length === 0 || newChunks.length === 0) return [];
  const candidates: Array<{ oldIndex: number; newIndex: number; score: number }> = [];

  for (let oldIndex = 0; oldIndex < oldChunks.length; oldIndex += 1) {
    for (let newIndex = 0; newIndex < newChunks.length; newIndex += 1) {
      candidates.push({
        oldIndex,
        newIndex,
        score: chunkSimilarity(oldChunks[oldIndex], newChunks[newIndex], oldIndex, newIndex),
      });
    }
  }
  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      Math.abs(left.oldIndex - left.newIndex) - Math.abs(right.oldIndex - right.newIndex),
  );

  const usedOld = new Set<number>();
  const usedNew = new Set<number>();
  const pairs: ChunkPair[] = [];
  for (const candidate of candidates) {
    if (
      candidate.score < 35 ||
      usedOld.has(candidate.oldIndex) ||
      usedNew.has(candidate.newIndex)
    ) {
      continue;
    }
    usedOld.add(candidate.oldIndex);
    usedNew.add(candidate.newIndex);
    pairs.push({
      oldId: oldChunks[candidate.oldIndex].id,
      newId: newChunks[candidate.newIndex].id,
    });
  }

  // OCR providers may alter titles or region kinds while retaining the same page
  // layout. When cardinality is unchanged, positional fallback is safer than
  // invalidating every saved citation.
  if (oldChunks.length === newChunks.length) {
    const remainingOld = oldChunks.map((_, index) => index).filter((index) => !usedOld.has(index));
    const remainingNew = newChunks.map((_, index) => index).filter((index) => !usedNew.has(index));
    for (let index = 0; index < Math.min(remainingOld.length, remainingNew.length); index += 1) {
      const oldIndex = remainingOld[index];
      const newIndex = remainingNew[index];
      pairs.push({ oldId: oldChunks[oldIndex].id, newId: newChunks[newIndex].id });
    }
  }

  return pairs;
}

function chunkSimilarity(
  oldChunk: MaterialChunk,
  newChunk: MaterialChunk,
  oldIndex: number,
  newIndex: number,
): number {
  let score = 0;
  if (oldChunk.section && newChunk.section && oldChunk.section === newChunk.section) score += 110;
  if (
    oldChunk.pageNumber != null &&
    newChunk.pageNumber != null &&
    oldChunk.pageNumber === newChunk.pageNumber
  ) {
    score += 45;
  }
  if (oldChunk.order === newChunk.order) score += 35;
  if (normalize(oldChunk.title) && normalize(oldChunk.title) === normalize(newChunk.title))
    score += 30;
  if (normalize(oldChunk.text) && normalize(oldChunk.text) === normalize(newChunk.text))
    score += 70;
  score += Math.max(0, 12 - Math.abs(oldIndex - newIndex) * 3);
  return score;
}

function collectReferencedChunkIds(data: AppData): string[] {
  return [
    ...data.notes.flatMap((note) => note.sourceChunkIds ?? []),
    ...data.flashcards.flatMap((card) => card.sourceChunkIds ?? []),
    ...data.quizQuestions.flatMap((question) => question.sourceChunkIds ?? []),
    ...data.presentationOutlines.flatMap((outline) =>
      outline.slides.flatMap((slide) => slide.sourceChunkIds ?? []),
    ),
  ];
}

function compareChunks(left: MaterialChunk, right: MaterialChunk): number {
  return (
    (left.pageNumber ?? 0) - (right.pageNumber ?? 0) ||
    left.order - right.order ||
    left.id.localeCompare(right.id)
  );
}

function normalize(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim();
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
