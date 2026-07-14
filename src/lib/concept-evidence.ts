import type { QuizAttemptDetailData } from "./quiz-attempt-details";
import type { AppData } from "./store";

export type ConceptEvidenceKind =
  | "recognition"
  | "recall"
  | "explanation"
  | "application"
  | "assessment";
export type ConceptEvidenceOutcome = "success" | "failure" | "mixed";
export type ConceptMistakeKind =
  | "retrieval"
  | "confusion"
  | "application"
  | "careless"
  | "unclassified";
export type ConceptKnowledgeState = "unseen" | "covered" | "fragile" | "weak" | "strong";
export type ForgettingRisk = "none" | "low" | "medium" | "high";
export type OpenAnswerReviewMode = "human" | "ai_human";

export interface Concept {
  id: string;
  courseId: string;
  topicId?: string;
  title: string;
  description?: string;
  aliases: string[];
  sourceChunkIds: string[];
  flashcardIds: string[];
  quizQuestionIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ConceptEvidenceEvent {
  id: string;
  conceptId: string;
  kind: ConceptEvidenceKind;
  outcome: ConceptEvidenceOutcome;
  sourceType:
    | "flashcard_review"
    | "quiz_attempt"
    | "quiz_question_answer"
    | "open_answer_review"
    | "manual";
  sourceId?: string;
  attemptId?: string;
  questionId?: string;
  sourceLabel?: string;
  mistakeKind?: ConceptMistakeKind;
  note?: string;
  score?: number;
  occurredAt: number;
  sourceChunkIds?: string[];
  prompt?: string;
  response?: string;
  reviewMode?: OpenAnswerReviewMode;
  reviewSummary?: string;
  repairOfEvidenceId?: string;
}

export interface ConceptEvidenceData {
  version: 1;
  concepts: Concept[];
  evidenceEvents: ConceptEvidenceEvent[];
}

export interface ConceptEvidenceSummary {
  state: ConceptKnowledgeState;
  forgettingRisk: ForgettingRisk;
  successCount: number;
  objectiveSuccessCount: number;
  failureCount: number;
  neutralAssessmentCount: number;
  distinctSuccessKinds: ConceptEvidenceKind[];
  distinctSuccessDays: number;
  latestSuccessAt?: number;
  latestFailureAt?: number;
  sourceCoverageCount: number;
  reason: string;
}

const DAY = 24 * 60 * 60 * 1000;

export function emptyConceptEvidenceData(): ConceptEvidenceData {
  return { version: 1, concepts: [], evidenceEvents: [] };
}

export function normalizeConceptEvidenceData(raw: unknown): ConceptEvidenceData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyConceptEvidenceData();
  const object = raw as Record<string, unknown>;
  const concepts = Array.isArray(object.concepts)
    ? object.concepts.map(normalizeConcept).filter((value): value is Concept => Boolean(value))
    : [];
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const evidenceEvents = Array.isArray(object.evidenceEvents)
    ? object.evidenceEvents
        .map(normalizeEvent)
        .filter((value): value is ConceptEvidenceEvent => Boolean(value && conceptIds.has(value.conceptId)))
    : [];
  return { version: 1, concepts, evidenceEvents };
}

function normalizeConcept(raw: unknown): Concept | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = stringValue(value.id);
  const courseId = stringValue(value.courseId);
  const title = stringValue(value.title).trim();
  if (!id || !courseId || !title) return null;
  const now = Date.now();
  return {
    id,
    courseId,
    topicId: optionalString(value.topicId),
    title: title.slice(0, 240),
    description: optionalString(value.description),
    aliases: stringArray(value.aliases),
    sourceChunkIds: stringArray(value.sourceChunkIds),
    flashcardIds: stringArray(value.flashcardIds),
    quizQuestionIds: stringArray(value.quizQuestionIds),
    createdAt: numberValue(value.createdAt, now),
    updatedAt: numberValue(value.updatedAt, now),
  };
}

function normalizeEvent(raw: unknown): ConceptEvidenceEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = stringValue(value.id);
  const conceptId = stringValue(value.conceptId);
  const kind = stringValue(value.kind) as ConceptEvidenceKind;
  const outcome = stringValue(value.outcome) as ConceptEvidenceOutcome;
  const sourceType = stringValue(value.sourceType) as ConceptEvidenceEvent["sourceType"];
  if (
    !id ||
    !conceptId ||
    !["recognition", "recall", "explanation", "application", "assessment"].includes(kind) ||
    !["success", "failure", "mixed"].includes(outcome) ||
    ![
      "flashcard_review",
      "quiz_attempt",
      "quiz_question_answer",
      "open_answer_review",
      "manual",
    ].includes(sourceType)
  ) {
    return null;
  }
  const mistake = optionalString(value.mistakeKind) as ConceptMistakeKind | undefined;
  const attemptId = optionalString(value.attemptId);
  const questionId = optionalString(value.questionId);
  if (sourceType === "quiz_question_answer" && (!attemptId || !questionId)) return null;
  const reviewMode = optionalString(value.reviewMode) as OpenAnswerReviewMode | undefined;
  const prompt = optionalString(value.prompt);
  const response = optionalString(value.response);
  if (
    sourceType === "open_answer_review" &&
    (!prompt || !response || !["explanation", "application"].includes(kind) || outcome === "mixed")
  ) {
    return null;
  }
  return {
    id,
    conceptId,
    kind,
    outcome,
    sourceType,
    sourceId: optionalString(value.sourceId),
    attemptId,
    questionId,
    sourceLabel: optionalString(value.sourceLabel),
    mistakeKind:
      mistake && ["retrieval", "confusion", "application", "careless", "unclassified"].includes(mistake)
        ? mistake
        : undefined,
    note: optionalString(value.note),
    score: typeof value.score === "number" && Number.isFinite(value.score) ? value.score : undefined,
    occurredAt: numberValue(value.occurredAt, Date.now()),
    sourceChunkIds: stringArray(value.sourceChunkIds),
    prompt,
    response,
    reviewMode:
      sourceType === "open_answer_review" &&
      reviewMode &&
      ["human", "ai_human"].includes(reviewMode)
        ? reviewMode
        : undefined,
    reviewSummary: optionalString(value.reviewSummary),
    repairOfEvidenceId: optionalString(value.repairOfEvidenceId),
  };
}

export function reconcileConceptEvidenceData(
  input: ConceptEvidenceData,
  core: AppData,
  detailData: QuizAttemptDetailData = { version: 1, attempts: [] },
): ConceptEvidenceData {
  const courseIds = new Set(core.courses.map((item) => item.id));
  const topicIds = new Set(core.topics.map((item) => item.id));
  const chunkIds = new Set(core.materialChunks.map((item) => item.id));
  const cardIds = new Set(core.flashcards.map((item) => item.id));
  const questionIds = new Set(core.quizQuestions.map((item) => item.id));
  const attemptsById = new Map(core.quizAttempts.map((attempt) => [attempt.id, attempt]));
  const detailsByAttemptId = new Map(detailData.attempts.map((detail) => [detail.attemptId, detail]));
  const questionsByQuiz = new Map<string, Set<string>>();
  for (const question of core.quizQuestions) {
    const current = questionsByQuiz.get(question.quizId) ?? new Set<string>();
    current.add(question.id);
    questionsByQuiz.set(question.quizId, current);
  }

  const concepts = input.concepts
    .filter((concept) => courseIds.has(concept.courseId))
    .map((concept) => ({
      ...concept,
      topicId: concept.topicId && topicIds.has(concept.topicId) ? concept.topicId : undefined,
      sourceChunkIds: concept.sourceChunkIds.filter((id) => chunkIds.has(id)),
      flashcardIds: concept.flashcardIds.filter((id) => cardIds.has(id)),
      quizQuestionIds: concept.quizQuestionIds.filter((id) => questionIds.has(id)),
    }));
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  const evidenceEvents = input.evidenceEvents
    .map((event) => {
      const concept = byId.get(event.conceptId);
      if (!concept) return null;
      if (event.sourceType === "open_answer_review") {
        const sourceChunkIds = (event.sourceChunkIds ?? []).filter(
          (id) => chunkIds.has(id) && concept.sourceChunkIds.includes(id),
        );
        if (sourceChunkIds.length === 0) return null;
        return { ...event, sourceChunkIds };
      }
      return event;
    })
    .filter((event): event is ConceptEvidenceEvent => {
      if (!event) return false;
      const concept = byId.get(event.conceptId);
      if (!concept) return false;
      if (event.sourceType === "flashcard_review" && event.sourceId) {
        return concept.flashcardIds.includes(event.sourceId) && cardIds.has(event.sourceId);
      }
      if (event.sourceType === "quiz_question_answer") {
        if (!event.attemptId || !event.questionId) return false;
        const attempt = attemptsById.get(event.attemptId);
        const detail = detailsByAttemptId.get(event.attemptId);
        if (!attempt || !detail || attempt.quizId !== detail.quizId) return false;
        return (
          questionIds.has(event.questionId) &&
          concept.quizQuestionIds.includes(event.questionId) &&
          detail.answers.some((answer) => answer.questionId === event.questionId)
        );
      }
      if (event.sourceType === "quiz_attempt" && event.sourceId) {
        const attempt = attemptsById.get(event.sourceId);
        if (!attempt || detailsByAttemptId.has(attempt.id)) return false;
        const quizQuestionIds = questionsByQuiz.get(attempt.quizId) ?? new Set<string>();
        return concept.quizQuestionIds.some((id) => quizQuestionIds.has(id));
      }
      return true;
    });
  const eventById = new Map(evidenceEvents.map((event) => [event.id, event]));
  return {
    version: 1,
    concepts,
    evidenceEvents: evidenceEvents.map((event) => {
      const repair = event.repairOfEvidenceId
        ? eventById.get(event.repairOfEvidenceId)
        : undefined;
      return {
        ...event,
        repairOfEvidenceId:
          repair && repair.conceptId === event.conceptId && repair.outcome === "failure"
            ? repair.id
            : undefined,
      };
    }),
  };
}

export function summarizeConceptEvidence(
  concept: Concept,
  events: ConceptEvidenceEvent[],
  now = Date.now(),
): ConceptEvidenceSummary {
  const relevant = events
    .filter((event) => event.conceptId === concept.id)
    .slice()
    .sort((left, right) => left.occurredAt - right.occurredAt);
  const scored = relevant.filter((event) => event.outcome !== "mixed" && event.kind !== "assessment");
  const successes = scored.filter((event) => event.outcome === "success");
  const objectiveSuccesses = successes.filter(evidenceIsObjective);
  const failures = scored.filter((event) => event.outcome === "failure");
  const latestSuccessAt = successes.at(-1)?.occurredAt;
  const latestFailureAt = failures.at(-1)?.occurredAt;
  const distinctSuccessKinds = Array.from(new Set(successes.map((event) => event.kind)));
  const distinctSuccessDays = new Set(
    successes.map((event) => new Date(event.occurredAt).toISOString().slice(0, 10)),
  ).size;
  const sourceCoverageCount = new Set(concept.sourceChunkIds).size;
  const neutralAssessmentCount = relevant.filter(
    (event) => event.kind === "assessment" || event.outcome === "mixed",
  ).length;

  const latestFailureDominates = Boolean(
    latestFailureAt && (!latestSuccessAt || latestFailureAt > latestSuccessAt),
  );
  const failureRate = scored.length ? failures.length / scored.length : 0;
  const recentSuccess = latestSuccessAt ? now - latestSuccessAt <= 21 * DAY : false;
  const strong =
    successes.length >= 4 &&
    objectiveSuccesses.length >= 2 &&
    distinctSuccessDays >= 2 &&
    distinctSuccessKinds.length >= 2 &&
    failureRate <= 0.34 &&
    !latestFailureDominates &&
    recentSuccess;
  const weak = failures.length >= 2 && (latestFailureDominates || failureRate >= 0.5);

  let state: ConceptKnowledgeState;
  let reason: string;
  if (strong) {
    state = "strong";
    reason = "Repeated successful evidence across multiple days and evidence types, including non-manual evidence.";
  } else if (weak) {
    state = "weak";
    reason = "Repeated failures or a recent failure dominate the available evidence.";
  } else if (successes.length > 0 || failures.length > 0) {
    state = "fragile";
    reason = "Some learning evidence exists, but it is limited, old, too manual, or not varied enough.";
  } else if (sourceCoverageCount > 0 || concept.flashcardIds.length > 0 || concept.quizQuestionIds.length > 0) {
    state = "covered";
    reason = "The concept is linked to sources or practice, but no scored learning evidence exists yet.";
  } else {
    state = "unseen";
    reason = "No source coverage or learning evidence has been linked.";
  }

  let forgettingRisk: ForgettingRisk = "none";
  if (latestSuccessAt) {
    const age = now - latestSuccessAt;
    forgettingRisk = age > 21 * DAY ? "high" : age > 7 * DAY ? "medium" : "low";
  }

  return {
    state,
    forgettingRisk,
    successCount: successes.length,
    objectiveSuccessCount: objectiveSuccesses.length,
    failureCount: failures.length,
    neutralAssessmentCount,
    distinctSuccessKinds,
    distinctSuccessDays,
    latestSuccessAt,
    latestFailureAt,
    sourceCoverageCount,
    reason,
  };
}

export function evidenceCountsTowardKnowledge(event: ConceptEvidenceEvent): boolean {
  return event.kind !== "assessment" && event.outcome !== "mixed";
}

export function evidenceIsObjective(event: ConceptEvidenceEvent): boolean {
  return (
    event.sourceType === "flashcard_review" ||
    event.sourceType === "quiz_question_answer" ||
    (event.sourceType === "open_answer_review" && event.reviewMode === "ai_human")
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function optionalString(value: unknown): string | undefined {
  const text = stringValue(value).trim();
  return text || undefined;
}
function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)))
    : [];
}
function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
