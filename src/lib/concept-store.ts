import { useSyncExternalStore } from "react";
import {
  emptyConceptEvidenceData,
  normalizeConceptEvidenceData,
  reconcileConceptEvidenceData,
  type Concept,
  type ConceptEvidenceData,
  type ConceptEvidenceEvent,
  type ConceptEvidenceKind,
  type ConceptEvidenceOutcome,
  type ConceptMistakeKind,
} from "./concept-evidence";
import {
  getQuizAttemptDetailSnapshot,
  type QuizAttemptDetailData,
} from "./quiz-attempt-details";
import { store, uid, type AppData } from "./store";

const KEY = "lamdan.concept-evidence.v1";
const SERVER_SNAPSHOT = emptyConceptEvidenceData();
let state: ConceptEvidenceData = SERVER_SNAPSHOT;
let hydrated = false;
let bridgeInstalled = false;
const listeners = new Set<() => void>();

function load(): ConceptEvidenceData {
  if (typeof window === "undefined") return emptyConceptEvidenceData();
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyConceptEvidenceData();
  try {
    return normalizeConceptEvidenceData(JSON.parse(raw));
  } catch {
    return emptyConceptEvidenceData();
  }
}

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = load();
}

function persist(next: ConceptEvidenceData): void {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  state = next;
  listeners.forEach((listener) => listener());
}

function update(updater: (current: ConceptEvidenceData) => ConceptEvidenceData): void {
  ensureHydrated();
  persist(normalizeConceptEvidenceData(updater(state)));
}

function subscribe(listener: () => void): () => void {
  ensureHydrated();
  queueMicrotask(listener);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useConceptEvidenceData(): ConceptEvidenceData {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
}

export function getConceptEvidenceSnapshot(): ConceptEvidenceData {
  ensureHydrated();
  return structuredCloneSafe(state);
}

export const conceptStore = {
  createConcept(input: {
    courseId: string;
    topicId?: string;
    title: string;
    description?: string;
    aliases?: string[];
  }): Concept {
    const now = Date.now();
    const concept: Concept = {
      id: uid("con"),
      courseId: input.courseId,
      topicId: input.topicId,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      aliases: input.aliases ?? [],
      sourceChunkIds: [],
      flashcardIds: [],
      quizQuestionIds: [],
      createdAt: now,
      updatedAt: now,
    };
    update((current) => ({ ...current, concepts: [...current.concepts, concept] }));
    return concept;
  },
  updateConcept(id: string, patch: Partial<Omit<Concept, "id" | "createdAt">>): void {
    update((current) => ({
      ...current,
      concepts: current.concepts.map((concept) =>
        concept.id === id ? { ...concept, ...patch, updatedAt: Date.now() } : concept,
      ),
    }));
  },
  deleteConcept(id: string): void {
    update((current) => ({
      ...current,
      concepts: current.concepts.filter((concept) => concept.id !== id),
      evidenceEvents: current.evidenceEvents.filter((event) => event.conceptId !== id),
    }));
  },
  recordEvidence(input: Omit<ConceptEvidenceEvent, "id" | "occurredAt"> & { occurredAt?: number }): void {
    const event: ConceptEvidenceEvent = {
      ...input,
      id: uid("cev"),
      occurredAt: input.occurredAt ?? Date.now(),
    };
    update((current) => ({ ...current, evidenceEvents: [event, ...current.evidenceEvents] }));
  },
  deleteEvidence(id: string): void {
    update((current) => ({
      ...current,
      evidenceEvents: current.evidenceEvents.filter((event) => event.id !== id),
    }));
  },
  updateEvidence(
    id: string,
    patch: Partial<Pick<ConceptEvidenceEvent, "mistakeKind" | "note">>,
  ): void {
    update((current) => ({
      ...current,
      evidenceEvents: current.evidenceEvents.map((event) =>
        event.id === id ? { ...event, ...patch } : event,
      ),
    }));
  },
  replaceAll(next: ConceptEvidenceData): void {
    persist(normalizeConceptEvidenceData(next));
  },
  reset(): void {
    persist(emptyConceptEvidenceData());
  },
};

export function reconcileConceptEvidence(
  core: AppData,
  detailData: QuizAttemptDetailData = getQuizAttemptDetailSnapshot(),
): void {
  ensureHydrated();
  const reconciled = reconcileConceptEvidenceData(state, core, detailData);
  if (JSON.stringify(reconciled) !== JSON.stringify(state)) persist(reconciled);
}

export function recordManualConceptEvidence(input: {
  conceptId: string;
  kind: Extract<ConceptEvidenceKind, "explanation" | "application">;
  outcome: Extract<ConceptEvidenceOutcome, "success" | "failure">;
  note?: string;
}): void {
  conceptStore.recordEvidence({
    conceptId: input.conceptId,
    kind: input.kind,
    outcome: input.outcome,
    sourceType: "manual",
    sourceLabel: "Self-recorded evidence",
    mistakeKind: input.outcome === "failure" ? defaultMistake(input.kind) : undefined,
    note: input.note,
  });
}

export function recordFlashcardReviewEvidence(
  cardId: string,
  quality: "again" | "good" | "easy",
): void {
  ensureHydrated();
  const linked = state.concepts.filter((concept) => concept.flashcardIds.includes(cardId));
  if (linked.length === 0) return;
  const outcome: ConceptEvidenceOutcome = quality === "again" ? "failure" : "success";
  const events = linked.map<ConceptEvidenceEvent>((concept) => ({
    id: uid("cev"),
    conceptId: concept.id,
    kind: "recall",
    outcome,
    sourceType: "flashcard_review",
    sourceId: cardId,
    sourceLabel: quality === "again" ? "Flashcard: Again" : `Flashcard: ${quality}`,
    mistakeKind: outcome === "failure" ? "retrieval" : undefined,
    occurredAt: Date.now(),
  }));
  update((current) => ({ ...current, evidenceEvents: [...events, ...current.evidenceEvents] }));
}

/**
 * New attempts with immutable answer snapshots become question-level recognition
 * evidence. Historical attempts without snapshots remain neutral aggregate context.
 */
export function syncQuizAttemptEvidence(
  core: AppData,
  detailData: QuizAttemptDetailData = getQuizAttemptDetailSnapshot(),
): void {
  ensureHydrated();
  const questionEvents = new Set(
    state.evidenceEvents
      .filter(
        (event) =>
          event.sourceType === "quiz_question_answer" && event.attemptId && event.questionId,
      )
      .map((event) => `${event.conceptId}:${event.attemptId}:${event.questionId}`),
  );
  const aggregateEvents = new Set(
    state.evidenceEvents
      .filter((event) => event.sourceType === "quiz_attempt" && event.sourceId)
      .map((event) => `${event.conceptId}:${event.sourceId}`),
  );
  const detailsByAttemptId = new Map(detailData.attempts.map((detail) => [detail.attemptId, detail]));
  const quizzes = new Map(core.quizzes.map((quiz) => [quiz.id, quiz]));
  const questionsByQuiz = new Map<string, string[]>();
  for (const question of core.quizQuestions) {
    const current = questionsByQuiz.get(question.quizId) ?? [];
    current.push(question.id);
    questionsByQuiz.set(question.quizId, current);
  }
  const additions: ConceptEvidenceEvent[] = [];

  for (const attempt of core.quizAttempts) {
    const detail = detailsByAttemptId.get(attempt.id);
    if (detail && detail.answers.length > 0) {
      for (const answer of detail.answers) {
        const linkedConcepts = state.concepts.filter((concept) =>
          concept.quizQuestionIds.includes(answer.questionId),
        );
        for (const concept of linkedConcepts) {
          const dedupeKey = `${concept.id}:${attempt.id}:${answer.questionId}`;
          if (questionEvents.has(dedupeKey)) continue;
          questionEvents.add(dedupeKey);
          additions.push({
            id: uid("cev"),
            conceptId: concept.id,
            kind: "recognition",
            outcome: answer.correct ? "success" : "failure",
            sourceType: "quiz_question_answer",
            sourceId: attempt.id,
            attemptId: attempt.id,
            questionId: answer.questionId,
            sourceLabel: answer.questionPrompt,
            mistakeKind: answer.correct ? undefined : "unclassified",
            note: answer.correct
              ? `Selected: ${answer.selectedOption}`
              : `Selected: ${answer.selectedOption} · Correct: ${answer.correctOption}`,
            score: answer.correct ? 100 : 0,
            occurredAt: attempt.takenAt,
          });
        }
      }
      continue;
    }

    const questionIds = new Set(questionsByQuiz.get(attempt.quizId) ?? []);
    if (questionIds.size === 0) continue;
    const quiz = quizzes.get(attempt.quizId);
    for (const concept of state.concepts) {
      if (!concept.quizQuestionIds.some((id) => questionIds.has(id))) continue;
      const dedupeKey = `${concept.id}:${attempt.id}`;
      if (aggregateEvents.has(dedupeKey)) continue;
      aggregateEvents.add(dedupeKey);
      additions.push({
        id: uid("cev"),
        conceptId: concept.id,
        kind: "assessment",
        outcome: "mixed",
        sourceType: "quiz_attempt",
        sourceId: attempt.id,
        sourceLabel: quiz?.title ?? "Quiz attempt",
        score: attempt.score,
        note: `${attempt.correctCount}/${attempt.total}`,
        occurredAt: attempt.takenAt,
      });
    }
  }

  if (additions.length > 0) {
    update((current) => ({ ...current, evidenceEvents: [...additions, ...current.evidenceEvents] }));
  }
}

export function installConceptEvidenceBridge(): void {
  if (bridgeInstalled) return;
  bridgeInstalled = true;
  const originalReviewCard = store.reviewCard.bind(store);
  store.reviewCard = ((id, quality) => {
    originalReviewCard(id, quality);
    recordFlashcardReviewEvidence(id, quality);
  }) as typeof store.reviewCard;
}

export function exportConceptEvidenceJSON(courseId?: string): string {
  ensureHydrated();
  if (!courseId) return JSON.stringify(state, null, 2);
  const concepts = state.concepts.filter((concept) => concept.courseId === courseId);
  const ids = new Set(concepts.map((concept) => concept.id));
  return JSON.stringify(
    {
      version: 1,
      concepts,
      evidenceEvents: state.evidenceEvents.filter((event) => ids.has(event.conceptId)),
    } satisfies ConceptEvidenceData,
    null,
    2,
  );
}

export function importConceptEvidenceJSON(
  json: string,
  mode: "replace" | "merge" = "merge",
): { ok: true; importedConcepts: number; importedEvents: number } | { ok: false; error: string } {
  try {
    const parsed = normalizeConceptEvidenceData(JSON.parse(json));
    if (mode === "replace") {
      persist(parsed);
      return {
        ok: true,
        importedConcepts: parsed.concepts.length,
        importedEvents: parsed.evidenceEvents.length,
      };
    }
    ensureHydrated();
    const concepts = mergeById(state.concepts, parsed.concepts);
    const evidenceEvents = mergeById(state.evidenceEvents, parsed.evidenceEvents);
    persist({ version: 1, concepts, evidenceEvents });
    return {
      ok: true,
      importedConcepts: parsed.concepts.length,
      importedEvents: parsed.evidenceEvents.length,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function defaultMistake(kind: ConceptEvidenceKind): ConceptMistakeKind {
  return kind === "application" ? "application" : "unclassified";
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
