import { useSyncExternalStore } from "react";
import {
  answerExamQuestion,
  createFrozenExamSession,
  emptyExamEngineData,
  normalizeExamEngineData,
  submitExamSession,
  validateExamBlueprint,
  type ExamBlueprint,
  type ExamEngineData,
  type ExamSession,
} from "./exam-engine";
import { inspectWorkspacePersistence } from "./persistence-health";
import {
  buildQuizAttemptAnswerSnapshots,
  getQuizAttemptDetailSnapshot,
  replaceQuizAttemptDetailData,
} from "./quiz-attempt-details";
import {
  getDataSnapshot,
  uid,
  updateData,
  type AppData,
  type QuizAttempt,
  type QuizQuestion,
} from "./store";

const KEY = "lamdan.exam-engine.v1";
const SERVER_SNAPSHOT = emptyExamEngineData();
let state = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? normalizeExamEngineData(JSON.parse(raw)) : emptyExamEngineData();
  } catch {
    state = emptyExamEngineData();
  }
}

function persist(next: ExamEngineData): void {
  const normalized = normalizeExamEngineData(next);
  if (typeof window !== "undefined") {
    const serialized = JSON.stringify(normalized);
    localStorage.setItem(KEY, serialized);
    if (localStorage.getItem(KEY) !== serialized) {
      throw new Error("Exam Engine data could not be verified after saving.");
    }
  }
  state = normalized;
  listeners.forEach((listener) => listener());
}

function update(updater: (current: ExamEngineData) => ExamEngineData): void {
  ensureHydrated();
  persist(updater(state));
}

function subscribe(listener: () => void): () => void {
  ensureHydrated();
  queueMicrotask(listener);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useExamEngineData(): ExamEngineData {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
}

export function getExamEngineSnapshot(): ExamEngineData {
  ensureHydrated();
  return JSON.parse(JSON.stringify(state)) as ExamEngineData;
}

export const examEngineStore = {
  createBlueprint(input: {
    courseId: string;
    quizId: string;
    title: string;
    durationMinutes: number;
    questionIds: string[];
    core: AppData;
  }): ExamBlueprint {
    const validation = validateExamBlueprint(input, input.core);
    if (!validation.ok) throw new Error(validation.errors.join(" "));
    const now = Date.now();
    const blueprint: ExamBlueprint = {
      id: uid("exam_blueprint"),
      courseId: input.courseId,
      quizId: input.quizId,
      title: input.title.trim(),
      durationMinutes: input.durationMinutes,
      questionIds: Array.from(new Set(input.questionIds)),
      createdAt: now,
      updatedAt: now,
    };
    update((current) => ({ ...current, blueprints: [blueprint, ...current.blueprints] }));
    return blueprint;
  },

  deleteBlueprint(id: string): void {
    update((current) => ({
      ...current,
      blueprints: current.blueprints.filter((item) => item.id !== id),
    }));
  },

  startSession(blueprintId: string, core: AppData, now = Date.now()): ExamSession {
    ensureHydrated();
    const blueprint = state.blueprints.find((item) => item.id === blueprintId);
    if (!blueprint) throw new Error("The exam blueprint no longer exists.");
    const validation = validateExamBlueprint(blueprint, core);
    if (!validation.ok) throw new Error(validation.errors.join(" "));
    const session = createFrozenExamSession({
      id: uid("exam_session"),
      blueprint,
      questions: validation.questions,
      startedAt: now,
    });
    persist({ ...state, sessions: [session, ...state.sessions] });
    return session;
  },

  answer(sessionId: string, questionId: string, selectedIndex: number, now = Date.now()): void {
    update((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? answerExamQuestion(session, questionId, selectedIndex, now)
          : session,
      ),
    }));
  },

  setCurrentQuestion(sessionId: string, questionId: string): void {
    update((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId &&
        session.status === "active" &&
        session.questions.some((question) => question.questionId === questionId)
          ? { ...session, currentQuestionId: questionId }
          : session,
      ),
    }));
  },

  submit(sessionId: string, now = Date.now()): ExamSession {
    ensureHydrated();
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error("The exam session no longer exists.");
    if (session.status !== "active") return session;
    const submitted = submitExamSession(session, now);
    const published = publishExamAttempt(submitted);
    const finalSession: ExamSession = {
      ...submitted,
      result: submitted.result
        ? { ...submitted.result, quizAttemptId: published.attempt.id }
        : undefined,
    };
    persist({
      ...state,
      sessions: state.sessions.map((item) => (item.id === sessionId ? finalSession : item)),
    });
    return finalSession;
  },

  abandon(sessionId: string): void {
    update((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId && session.status === "active"
          ? { ...session, status: "abandoned" }
          : session,
      ),
    }));
  },

  deleteSession(sessionId: string): void {
    update((current) => ({
      ...current,
      sessions: current.sessions.filter((session) => session.id !== sessionId),
    }));
  },
};

function publishExamAttempt(session: ExamSession): {
  attempt: QuizAttempt;
  persistenceOk: boolean;
  error?: string;
} {
  if (!session.result) throw new Error("The exam has no submitted result.");
  const answeredQuestions = session.questions.filter((question) =>
    Number.isInteger(session.answers[question.questionId]),
  );
  const answers = Object.fromEntries(
    answeredQuestions.map((question) => [
      question.questionId,
      session.answers[question.questionId],
    ]),
  );
  const quizQuestions = answeredQuestions.map<QuizQuestion>((question) => ({
    id: question.questionId,
    quizId: question.quizId,
    prompt: question.prompt,
    options: question.options.slice(),
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    sourceChunkIds: question.sourceChunkIds.slice(),
  }));
  const answerSnapshots =
    quizQuestions.length > 0 ? buildQuizAttemptAnswerSnapshots(quizQuestions, answers) : [];
  const attempt: QuizAttempt = {
    id: uid("att"),
    quizId: session.quizId,
    score: session.result.score,
    correctCount: session.result.correctCount,
    total: session.result.total,
    takenAt: session.result.submittedAt,
  };

  const previousDetails = getQuizAttemptDetailSnapshot();
  if (answerSnapshots.length > 0) {
    replaceQuizAttemptDetailData({
      version: 1,
      attempts: [
        {
          attemptId: attempt.id,
          quizId: session.quizId,
          mode: "exam",
          answers: answerSnapshots,
          createdAt: session.result.submittedAt,
        },
        ...previousDetails.attempts,
      ],
    });
  }
  try {
    updateData((current) => ({
      ...current,
      quizAttempts: [attempt, ...current.quizAttempts],
    }));
  } catch (error) {
    replaceQuizAttemptDetailData(previousDetails);
    throw error;
  }
  const health = inspectWorkspacePersistence(getDataSnapshot());
  return { attempt, persistenceOk: health.ok, error: health.error };
}
