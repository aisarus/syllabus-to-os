import type { AppData } from "./store";

export const GLOBAL_SEARCH_VERSION = "local-search-v2";

export const GLOBAL_SEARCH_KINDS = [
  "course",
  "topic",
  "material",
  "chunk",
  "note",
  "flashcard",
  "quiz",
  "question",
  "assignment",
  "outline",
] as const;

export type GlobalSearchKind = (typeof GLOBAL_SEARCH_KINDS)[number];

export interface GlobalSearchRange {
  start: number;
  end: number;
}

export interface GlobalSearchHit {
  kind: GlobalSearchKind;
  id: string;
  title: string;
  snippet: string;
  score: number;
  matchedField: string;
  titleRanges: GlobalSearchRange[];
  snippetRanges: GlobalSearchRange[];
  courseId?: string;
  materialId?: string;
  quizId?: string;
  pageNumber?: number;
  sourceTitle?: string;
}

export interface GlobalSearchOptions {
  limit?: number;
  kinds?: GlobalSearchKind[];
  courseId?: string;
}

interface SearchField {
  name: string;
  value: string;
  weight: number;
  snippet: boolean;
}

interface SearchDocument {
  kind: GlobalSearchKind;
  id: string;
  title: string;
  fields: SearchField[];
  courseId?: string;
  materialId?: string;
  quizId?: string;
  pageNumber?: number;
  sourceTitle?: string;
}

interface ParsedQuery {
  normalized: string;
  terms: string[];
}

interface NormalizedMap {
  value: string;
  starts: number[];
  ends: number[];
}

const SEARCH_MARK_PATTERN = /[\u0300-\u036f\u0591-\u05c7]/u;
const SEARCH_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;

export function normalizeSearchText(value: string): string {
  return normalizeWithMap(value).value;
}

export function parseGlobalSearchQuery(query: string): ParsedQuery {
  const terms: string[] = [];
  const matcher = /"([^"]+)"|(\S+)/gu;
  for (const match of query.matchAll(matcher)) {
    const normalized = normalizeSearchText(match[1] ?? match[2] ?? "");
    if (normalized && !terms.includes(normalized)) terms.push(normalized);
  }
  const normalized = normalizeSearchText(query.replace(/"/gu, " "));
  return { normalized, terms };
}

export function searchWorkspace(
  data: AppData,
  query: string,
  options: GlobalSearchOptions = {},
): GlobalSearchHit[] {
  const parsed = parseGlobalSearchQuery(query);
  if (parsed.terms.length === 0) return [];

  const kindFilter = options.kinds ? new Set(options.kinds) : null;
  const limit = Math.max(1, Math.min(options.limit ?? 120, 500));
  const hits = buildDocuments(data)
    .filter((document) => !kindFilter || kindFilter.has(document.kind))
    .filter((document) => !options.courseId || document.courseId === options.courseId)
    .map((document) => scoreDocument(document, parsed))
    .filter((hit): hit is GlobalSearchHit => hit !== null)
    .sort(compareHits);

  return hits.slice(0, limit);
}

export function countGlobalSearchKinds(
  hits: GlobalSearchHit[],
): Record<GlobalSearchKind, number> {
  const counts = Object.fromEntries(GLOBAL_SEARCH_KINDS.map((kind) => [kind, 0])) as Record<
    GlobalSearchKind,
    number
  >;
  for (const hit of hits) counts[hit.kind] += 1;
  return counts;
}

function buildDocuments(data: AppData): SearchDocument[] {
  const documents: SearchDocument[] = [];
  const materialById = new Map(data.materials.map((material) => [material.id, material]));
  const quizById = new Map(data.quizzes.map((quiz) => [quiz.id, quiz]));

  for (const course of data.courses) {
    documents.push({
      kind: "course",
      id: course.id,
      title: course.title,
      courseId: course.id,
      fields: compactFields([
        field("title", course.title, 34, false),
        field("originalTitle", course.originalTitle, 28, false),
        field("number", course.number, 30, false),
        field("description", course.description, 11, true),
        field("instructor", course.instructor, 14, true),
        field("semester", course.semester, 8, true),
      ]),
    });
  }

  for (const topic of data.topics) {
    documents.push({
      kind: "topic",
      id: topic.id,
      title: topic.title,
      courseId: topic.courseId,
      fields: compactFields([
        field("title", topic.title, 32, false),
        field("description", topic.description, 12, true),
      ]),
    });
  }

  for (const material of data.materials) {
    documents.push({
      kind: "material",
      id: material.id,
      title: material.title,
      courseId: material.courseId,
      materialId: material.id,
      fields: compactFields([
        field("title", material.title, 36, false),
        field("tags", material.tags.join(" "), 25, true),
        field("summary", material.userSummary, 18, true),
        field("source", material.rawText, 10, true),
        field("fileName", material.fileName, 18, true),
      ]),
    });
  }

  for (const chunk of data.materialChunks) {
    const material = materialById.get(chunk.materialId);
    documents.push({
      kind: "chunk",
      id: chunk.id,
      title: chunk.title || `${material?.title ?? "Source"} · ${chunk.order + 1}`,
      courseId: material?.courseId,
      materialId: chunk.materialId,
      pageNumber: chunk.pageNumber,
      sourceTitle: material?.title,
      fields: compactFields([
        field("title", chunk.title, 30, false),
        field("section", chunk.section, 24, true),
        field("source", chunk.text, 17, true),
        field("materialTitle", material?.title, 12, false),
      ]),
    });
  }

  for (const note of data.notes) {
    documents.push({
      kind: "note",
      id: note.id,
      title: note.title || "Untitled note",
      courseId: note.courseId,
      materialId: note.materialId,
      fields: compactFields([
        field("title", note.title, 38, false),
        field("tags", note.tags.join(" "), 27, true),
        field("content", note.content, 19, true),
      ]),
    });
  }

  for (const card of data.flashcards) {
    documents.push({
      kind: "flashcard",
      id: card.id,
      title: card.front,
      courseId: card.courseId,
      materialId: card.materialId,
      fields: compactFields([
        field("front", card.front, 36, false),
        field("back", card.back, 22, true),
      ]),
    });
  }

  for (const quiz of data.quizzes) {
    documents.push({
      kind: "quiz",
      id: quiz.id,
      title: quiz.title,
      courseId: quiz.courseId,
      materialId: quiz.materialId,
      quizId: quiz.id,
      fields: compactFields([field("title", quiz.title, 36, false)]),
    });
  }

  for (const question of data.quizQuestions) {
    const quiz = quizById.get(question.quizId);
    documents.push({
      kind: "question",
      id: question.id,
      title: question.prompt,
      courseId: quiz?.courseId,
      materialId: quiz?.materialId,
      quizId: question.quizId,
      sourceTitle: quiz?.title,
      fields: compactFields([
        field("prompt", question.prompt, 36, false),
        field("options", question.options.join("\n"), 19, true),
        field("explanation", question.explanation, 15, true),
        field("quizTitle", quiz?.title, 12, false),
      ]),
    });
  }

  for (const assignment of data.assignments) {
    documents.push({
      kind: "assignment",
      id: assignment.id,
      title: assignment.title,
      courseId: assignment.courseId,
      fields: compactFields([
        field("title", assignment.title, 34, false),
        field("notes", assignment.notes, 16, true),
        field("grade", assignment.grade, 8, true),
      ]),
    });
  }

  for (const outline of data.presentationOutlines) {
    const slideText = outline.slides
      .flatMap((slide) => [
        slide.title,
        ...slide.bullets,
        slide.speakerNotes ?? "",
        slide.sourceQuote ?? "",
      ])
      .join("\n");
    documents.push({
      kind: "outline",
      id: outline.id,
      title: outline.title,
      courseId: outline.courseId,
      materialId: outline.materialId,
      fields: compactFields([
        field("title", outline.title, 36, false),
        field("slides", slideText, 14, true),
      ]),
    });
  }

  return documents;
}

function scoreDocument(document: SearchDocument, query: ParsedQuery): GlobalSearchHit | null {
  const normalizedFields = document.fields.map((item) => ({
    item,
    normalized: normalizeSearchText(item.value),
  }));
  if (
    !query.terms.every((term) =>
      normalizedFields.some(({ normalized }) => normalized.includes(term)),
    )
  ) {
    return null;
  }

  let score = 0;
  let bestField = normalizedFields[0];
  let bestFieldScore = -1;
  for (const term of query.terms) {
    let bestTermScore = 0;
    for (const candidate of normalizedFields) {
      const termScore = fieldMatchScore(candidate.normalized, term, candidate.item.weight);
      if (termScore > bestTermScore) bestTermScore = termScore;
      if (termScore > bestFieldScore) {
        bestFieldScore = termScore;
        bestField = candidate;
      }
    }
    score += bestTermScore;
  }

  const normalizedTitle = normalizeSearchText(document.title);
  if (normalizedTitle === query.normalized) score += 120;
  else if (normalizedTitle.startsWith(query.normalized)) score += 70;
  else if (normalizedTitle.includes(query.normalized)) score += 42;

  if (
    normalizedFields.some(({ normalized }) =>
      query.terms.every((term) => normalized.includes(term)),
    )
  ) {
    score += 18;
  }
  score += kindBoost(document.kind);

  const snippetField = selectSnippetField(normalizedFields, query.terms, bestField);
  const snippet = createSnippet(snippetField?.item.value ?? "", query.terms);

  return {
    kind: document.kind,
    id: document.id,
    title: document.title,
    snippet: snippet.text,
    score: Math.round(score * 100) / 100,
    matchedField: snippetField?.item.name ?? bestField?.item.name ?? "title",
    titleRanges: findSearchRanges(document.title, query.terms),
    snippetRanges: snippet.ranges,
    courseId: document.courseId,
    materialId: document.materialId,
    quizId: document.quizId,
    pageNumber: document.pageNumber,
    sourceTitle: document.sourceTitle,
  };
}

function field(name: string, value: string | undefined, weight: number, snippet: boolean): SearchField {
  return { name, value: value ?? "", weight, snippet };
}

function compactFields(fields: SearchField[]): SearchField[] {
  return fields.filter((item) => item.value.trim());
}

function fieldMatchScore(normalized: string, term: string, weight: number): number {
  if (!normalized || !term) return 0;
  if (normalized === term) return weight * 4;
  if (normalized.startsWith(term)) return weight * 2.6;
  if (hasWordBoundaryMatch(normalized, term)) return weight * 1.8;
  if (normalized.includes(term)) return weight;
  return 0;
}

function hasWordBoundaryMatch(value: string, term: string): boolean {
  const index = value.indexOf(term);
  if (index < 0) return false;
  const before = index === 0 ? " " : value[index - 1];
  const after = index + term.length >= value.length ? " " : value[index + term.length];
  return before === " " || after === " ";
}

function selectSnippetField(
  fields: Array<{ item: SearchField; normalized: string }>,
  terms: string[],
  fallback: { item: SearchField; normalized: string } | undefined,
) {
  const candidates = fields
    .filter(({ item }) => item.snippet)
    .map((candidate) => ({
      candidate,
      matches: terms.filter((term) => candidate.normalized.includes(term)).length,
      score: terms.reduce(
        (total, term) =>
          total + fieldMatchScore(candidate.normalized, term, candidate.item.weight),
        0,
      ),
    }))
    .filter((entry) => entry.matches > 0)
    .sort((left, right) => right.matches - left.matches || right.score - left.score);
  return candidates[0]?.candidate ?? fallback;
}

function createSnippet(
  value: string,
  terms: string[],
  maximumLength = 220,
): { text: string; ranges: GlobalSearchRange[] } {
  if (!value.trim()) return { text: "", ranges: [] };
  const mapped = normalizeWithMap(value);
  const normalizedIndexes = terms
    .map((term) => mapped.value.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);
  const normalizedIndex = normalizedIndexes[0] ?? 0;
  const originalIndex = mapped.starts[normalizedIndex] ?? 0;
  const start = Math.max(0, originalIndex - 72);
  const end = Math.min(value.length, start + maximumLength);
  const text = `${start > 0 ? "…" : ""}${value.slice(start, end).trim()}${end < value.length ? "…" : ""}`;
  return { text, ranges: findSearchRanges(text, terms) };
}

export function findSearchRanges(value: string, terms: string[]): GlobalSearchRange[] {
  if (!value || terms.length === 0) return [];
  const mapped = normalizeWithMap(value);
  const ranges: GlobalSearchRange[] = [];
  for (const term of terms) {
    let offset = 0;
    while (offset < mapped.value.length) {
      const index = mapped.value.indexOf(term, offset);
      if (index < 0) break;
      const start = mapped.starts[index];
      const end = mapped.ends[index + term.length - 1];
      if (start != null && end != null) ranges.push({ start, end });
      offset = index + Math.max(1, term.length);
    }
  }
  return mergeRanges(ranges);
}

function normalizeWithMap(value: string): NormalizedMap {
  let normalized = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let previousWasSpace = false;

  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index);
    const character = codePoint == null ? "" : String.fromCodePoint(codePoint);
    const width = character.length || 1;
    const sourceEnd = index + width;
    const decomposed = character.normalize("NFKD").toLocaleLowerCase();

    for (const part of decomposed) {
      if (SEARCH_MARK_PATTERN.test(part)) continue;
      if (SEARCH_CHARACTER_PATTERN.test(part)) {
        normalized += part;
        starts.push(index);
        ends.push(sourceEnd);
        previousWasSpace = false;
      } else if (!previousWasSpace && normalized.length > 0) {
        normalized += " ";
        starts.push(index);
        ends.push(sourceEnd);
        previousWasSpace = true;
      }
    }
    index = sourceEnd;
  }

  while (normalized.endsWith(" ")) {
    normalized = normalized.slice(0, -1);
    starts.pop();
    ends.pop();
  }
  return { value: normalized, starts, ends };
}

function mergeRanges(ranges: GlobalSearchRange[]): GlobalSearchRange[] {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: GlobalSearchRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) merged.push({ ...range });
    else previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

function kindBoost(kind: GlobalSearchKind): number {
  switch (kind) {
    case "note":
      return 10;
    case "chunk":
      return 8;
    case "material":
      return 7;
    case "course":
      return 6;
    case "topic":
      return 5;
    case "flashcard":
    case "question":
      return 4;
    default:
      return 2;
  }
}

function compareHits(left: GlobalSearchHit, right: GlobalSearchHit): number {
  return (
    right.score - left.score ||
    left.title.localeCompare(right.title, undefined, { sensitivity: "base", numeric: true }) ||
    left.kind.localeCompare(right.kind) ||
    left.id.localeCompare(right.id)
  );
}
