import { useSyncExternalStore } from "react";
import { inspectWorkspacePersistence } from "./persistence-health";
import {
  getDataSnapshot,
  uid,
  updateData,
  type AppData,
  type QuizAttempt,
  type QuizQuestion,
} from "./store";

export type QuizRunMode = "practice" | "exam" | "trainer";

export interface QuizAttemptAnswerSnapshot {
  questionId: string;
  questionPrompt: string;
  selectedIndex: number;
  selectedOption: string;
  correctIndex: number;
  correctOption: string;
  correct: boolean;
  sourceChunkIds: string[];
}

export interface QuizAttemptDetail {
  attemptId: string;
  quizId: string;
  mode: QuizRunMode;
  answers: QuizAttemptAnswerSnapshot[];
  createdAt: number;
}

export interface QuizAttemptDetailData {
  version: 1;
  attempts: QuizAttemptDetail[];
}

export interface RecordedQuizAttempt {
  attempt: QuizAttempt;
  detail: QuizAttemptDetail;
  persistenceOk: boolean;
  error?: string;
}

const KEY = "lamdan.quiz-attempt-details.v1";
const SERVER_SNAPSHOT: QuizAttemptDetailData = emptyQuizAttemptDetailData();
let state = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();

export function emptyQuizAttemptDetailData(): QuizAttemptDetailData {
  return { version: 1, attempts: [] };
}

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? normalizeQuizAttemptDetailData(JSON.parse(raw)) : emptyQuizAttemptDetailData();
  } catch {
    state = emptyQuizAttemptDetailData();
  }
}

function persist(next: QuizAttemptDetailData): void {
  const normalized = normalizeQuizAttemptDetailData(next);
  if (typeof window !== "undefined") {
    const serialized = JSON.stringify(normalized);
    localStorage.setItem(KEY, serialized);
    if (localStorage.getItem(KEY) !== serialized) {
      throw new Error("Per-question quiz evidence could not be verified after saving.");
    }
  }
  state = normalized;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  ensureHydrated();
  queueMicrotask(listener);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useQuizAttemptDetailData(): QuizAttemptDetailData {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
}

export function getQuizAttemptDetailSnapshot(): QuizAttemptDetailData {
  ensureHydrated();
  return JSON.parse(JSON.stringify(state)) as QuizAttemptDetailData;
}

export function replaceQuizAttemptDetailData(next: QuizAttemptDetailData): void {
  persist(next);
}

export function buildQuizAttemptAnswerSnapshots(
  questions: QuizQuestion[],
  answers: Record<string, number>,
): QuizAttemptAnswerSnapshot[] {
  return questions.map((question) => {
    const selectedIndex = answers[question.id];
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= question.options.length) {
      throw new Error(`Question ${question.id} has no valid selected answer.`);
    }
    if (
      !Number.isInteger(question.correctIndex) ||
      question.correctIndex < 0 ||
      question.correctIndex >= question.options.length
    ) {
      throw new Error(`Question ${question.id} has no valid correct answer.`);
    }
    return {
      questionId: question.id,
      questionPrompt: question.prompt,
      selectedIndex,
      selectedOption: question.options[selectedIndex] ?? "",
      correctIndex: question.correctIndex,
      correctOption: question.options[question.correctIndex] ?? "",
      correct: selectedIndex === question.correctIndex,
      sourceChunkIds: Array.from(new Set(question.sourceChunkIds ?? [])),
    };
  });
}

export function recordQuizAttemptWithAnswers(input: {
  quizId: string;
  mode: QuizRunMode;
  questions: QuizQuestion[];
  answers: Record<string, number>;
}): RecordedQuizAttempt {
  if (input.questions.length === 0) throw new Error("A quiz attempt needs at least one question.");
  const answerSnapshots = buildQuizAttemptAnswerSnapshots(input.questions, input.answers);
  const correctCount = answerSnapshots.filter((answer) => answer.correct).length;
  const total = answerSnapshots.length;
  const takenAt = Date.now();
  const attempt: QuizAttempt = {
    id: uid("att"),
    quizId: input.quizId,
    score: Math.round((correctCount / total) * 100),
    correctCount,
    total,
    takenAt,
  };
  const detail: QuizAttemptDetail = {
    attemptId: attempt.id,
    quizId: input.quizId,
    mode: input.mode,
    answers: answerSnapshots,
    createdAt: takenAt,
  };

  ensureHydrated();
  persist({ version: 1, attempts: [detail, ...state.attempts.filter((item) => item.attemptId !== attempt.id)] });
  updateData((current) => ({ ...current, quizAttempts: [attempt, ...current.quizAttempts] }));
  const health = inspectWorkspacePersistence(getDataSnapshot());
  return {
    attempt,
    detail,
    persistenceOk: health.ok,
    error: health.error,
  };
}

export function reconcileQuizAttemptDetailData(
  input: QuizAttemptDetailData,
  core: AppData,
): QuizAttemptDetailData {
  const attemptIds = new Set(core.quizAttempts.map((attempt) => attempt.id));
  const quizIds = new Set(core.quizzes.map((quiz) => quiz.id));
  return {
    version: 1,
    attempts: input.attempts.filter(
      (detail) => attemptIds.has(detail.attemptId) && quizIds.has(detail.quizId),
    ),
  };
}

export function reconcileQuizAttemptDetails(core: AppData): void {
  ensureHydrated();
  const next = reconcileQuizAttemptDetailData(state, core);
  if (JSON.stringify(next) !== JSON.stringify(state)) persist(next);
}

export function deleteQuizAttemptDetailsForQuiz(quizId: string): void {
  ensureHydrated();
  const next = state.attempts.filter((detail) => detail.quizId !== quizId);
  if (next.length !== state.attempts.length) persist({ version: 1, attempts: next });
}

export function normalizeQuizAttemptDetailData(raw: unknown): QuizAttemptDetailData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyQuizAttemptDetailData();
  const object = raw as Record<string, unknown>;
  const attempts = Array.isArray(object.attempts)
    ? object.attempts
        .map(normalizeAttemptDetail)
        .filter((value): value is QuizAttemptDetail => Boolean(value))
    : [];
  return { version: 1, attempts };
}

function normalizeAttemptDetail(raw: unknown): QuizAttemptDetail | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const attemptId = text(value.attemptId);
  const quizId = text(value.quizId);
  const mode = text(value.mode) as QuizRunMode;
  if (!attemptId || !quizId || !["practice", "exam", "trainer"].includes(mode)) return null;
  const answers = Array.isArray(value.answers)
    ? value.answers
        .map(normalizeAnswerSnapshot)
        .filter((answer): answer is QuizAttemptAnswerSnapshot => Boolean(answer))
    : [];
  if (answers.length === 0) return null;
  return {
    attemptId,
    quizId,
    mode,
    answers,
    createdAt: finiteNumber(value.createdAt, Date.now()),
  };
}

function normalizeAnswerSnapshot(raw: unknown): QuizAttemptAnswerSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const questionId = text(value.questionId);
  const questionPrompt = text(value.questionPrompt);
  const selectedIndex = finiteNumber(value.selectedIndex, -1);
  const correctIndex = finiteNumber(value.correctIndex, -1);
  if (!questionId || !questionPrompt || selectedIndex < 0 || correctIndex < 0) return null;
  return {
    questionId,
    questionPrompt,
    selectedIndex,
    selectedOption: text(value.selectedOption),
    correctIndex,
    correctOption: text(value.correctOption),
    correct: value.correct === true,
    sourceChunkIds: Array.isArray(value.sourceChunkIds)
      ? Array.from(new Set(value.sourceChunkIds.filter((item): item is string => typeof item === "string")))
      : [],
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
