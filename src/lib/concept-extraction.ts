import type { Concept } from "./concept-evidence";
import type { Note } from "./store";

export type ConceptCandidateOrigin = "ai_source_chunks" | "study_pack_note";

export interface ConceptCandidateDraft {
  title: string;
  description: string;
  aliases: string[];
  sourceChunkIds: string[];
}

export interface ConceptCandidateReview extends ConceptCandidateDraft {
  id: string;
  origin: ConceptCandidateOrigin;
  sourceLabel?: string;
  selected: boolean;
  duplicateOf?: string;
}

export interface ConceptExtractionDraft {
  candidates: ConceptCandidateDraft[];
  warnings: string[];
  notFoundInSources?: boolean;
  trust?: {
    model: string;
    promptVersion: string;
    requestedSourceChunkIds: string[];
    rejectedSourceChunkIds: string[];
    uncitedItemCount: number;
  };
}

export function normalizeConceptKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findConceptDuplicate(
  candidate: Pick<ConceptCandidateDraft, "title" | "aliases">,
  concepts: Concept[],
): Concept | undefined {
  const candidateKeys = new Set(
    [candidate.title, ...candidate.aliases].map(normalizeConceptKey).filter(Boolean),
  );
  return concepts.find((concept) =>
    [concept.title, ...concept.aliases]
      .map(normalizeConceptKey)
      .filter(Boolean)
      .some((key) => candidateKeys.has(key)),
  );
}

export function normalizeConceptCandidate(
  raw: Partial<ConceptCandidateDraft>,
  allowedSourceChunkIds: Iterable<string>,
): ConceptCandidateDraft | null {
  const allowed = new Set(allowedSourceChunkIds);
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 240) : "";
  const description =
    typeof raw.description === "string" ? raw.description.trim().slice(0, 2_000) : "";
  const aliases = Array.from(
    new Set(
      (Array.isArray(raw.aliases) ? raw.aliases : [])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().slice(0, 160))
        .filter((value) => value && normalizeConceptKey(value) !== normalizeConceptKey(title)),
    ),
  ).slice(0, 8);
  const sourceChunkIds = Array.from(
    new Set(
      (Array.isArray(raw.sourceChunkIds) ? raw.sourceChunkIds : []).filter(
        (value): value is string => typeof value === "string" && allowed.has(value),
      ),
    ),
  );
  if (!title || !description || sourceChunkIds.length === 0) return null;
  return { title, description, aliases, sourceChunkIds };
}

export function buildReviewCandidates(input: {
  candidates: ConceptCandidateDraft[];
  origin: ConceptCandidateOrigin;
  sourceLabel?: string;
  allowedSourceChunkIds: Iterable<string>;
  existingConcepts: Concept[];
  idPrefix?: string;
}): ConceptCandidateReview[] {
  const output: ConceptCandidateReview[] = [];
  const comparisonConcepts = [...input.existingConcepts];
  input.candidates.forEach((raw, index) => {
    const candidate = normalizeConceptCandidate(raw, input.allowedSourceChunkIds);
    if (!candidate) return;
    const id = `${input.idPrefix ?? input.origin}-${Date.now()}-${index}`;
    const duplicate = findConceptDuplicate(candidate, comparisonConcepts);
    output.push({
      ...candidate,
      id,
      origin: input.origin,
      sourceLabel: input.sourceLabel,
      selected: !duplicate,
      duplicateOf: duplicate?.id,
    });
    if (!duplicate) {
      comparisonConcepts.push({
        id,
        courseId: "candidate-review",
        title: candidate.title,
        description: candidate.description,
        aliases: candidate.aliases,
        sourceChunkIds: candidate.sourceChunkIds,
        flashcardIds: [],
        quizQuestionIds: [],
        createdAt: 0,
        updatedAt: 0,
      });
    }
  });
  return output;
}

export function extractStudyPackConceptCandidates(input: {
  notes: Note[];
  allowedSourceChunkIds: Iterable<string>;
  existingConcepts: Concept[];
}): ConceptCandidateReview[] {
  const allowed = new Set(input.allowedSourceChunkIds);
  const reviews: ConceptCandidateReview[] = [];
  const comparisonConcepts = [...input.existingConcepts];
  for (const note of input.notes) {
    if (!note.tags.includes("study-pack")) continue;
    const sourceChunkIds = note.sourceChunkIds.filter((id) => allowed.has(id));
    if (sourceChunkIds.length === 0) continue;
    const candidates = parseStudyPackKeyTerms(note.content).map((term) => ({
      title: term.term,
      description: term.explanation,
      aliases: [],
      sourceChunkIds,
    }));
    const next = buildReviewCandidates({
      candidates,
      origin: "study_pack_note",
      sourceLabel: note.title,
      allowedSourceChunkIds: allowed,
      existingConcepts: comparisonConcepts,
      idPrefix: `study-pack-${note.id}`,
    });
    reviews.push(...next);
    comparisonConcepts.push(
      ...next
        .filter((candidate) => !candidate.duplicateOf)
        .map((candidate) => ({
          id: candidate.id,
          courseId: "candidate-review",
          title: candidate.title,
          description: candidate.description,
          aliases: candidate.aliases,
          sourceChunkIds: candidate.sourceChunkIds,
          flashcardIds: [],
          quizQuestionIds: [],
          createdAt: 0,
          updatedAt: 0,
        })),
    );
  }
  return reviews;
}

export function parseStudyPackKeyTerms(content: string): Array<{
  term: string;
  explanation: string;
}> {
  const lines = content.split(/\r?\n/);
  let inside = false;
  const terms: Array<{ term: string; explanation: string }> = [];
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const title = normalizeConceptKey(heading[1]);
      inside = title === "ключевые термины" || title === "key terms";
      continue;
    }
    if (!inside) continue;
    const match = line.match(/^\s*-\s+\*\*(.+?)\*\*\s*[—–-]\s*(.+?)\s*$/);
    if (!match) continue;
    const term = match[1].trim();
    const explanation = match[2].trim();
    if (term && explanation) terms.push({ term, explanation });
  }
  return terms;
}
