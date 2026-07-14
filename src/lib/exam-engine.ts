import type { AppData, QuizQuestion } from "./store";

export type ExamSessionStatus = "active" | "submitted" | "abandoned";

export interface ExamBlueprint {
  id: string;
  courseId: string;
  quizId: string;
  title: string;
  durationMinutes: number;
  questionIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface FrozenExamQuestion {
  questionId: string;
  quizId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  sourceChunkIds: string[];
}

export interface ExamQuestionResult {
  questionId: string;
  selectedIndex?: number;
  correctIndex: number;
  correct: boolean;
  unanswered: boolean;
}

export interface ExamResult {
  submittedAt: number;
  timedOut: boolean;
  score: number;
  correctCount: number;
  answeredCount: number;
  unansweredCount: number;
  total: number;
  questions: ExamQuestionResult[];
  quizAttemptId?: string;
}

export interface ExamSession {
  id: string;
  blueprintId: string;
  courseId: string;
  quizId: string;
  title: string;
  startedAt: number;
  deadlineAt: number;
  status: ExamSessionStatus;
  questions: FrozenExamQuestion[];
  answers: Record<string, number>;
  currentQuestionId?: string;
  result?: ExamResult;
}

export interface ExamEngineData {
  version: 1;
  blueprints: ExamBlueprint[];
  sessions: ExamSession[];
}

export interface ExamBlueprintValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  questions: QuizQuestion[];
  distinctSourceChunkIds: string[];
}

export function emptyExamEngineData(): ExamEngineData {
  return { version: 1, blueprints: [], sessions: [] };
}

export function validateExamBlueprint(
  blueprint: Pick<ExamBlueprint, "courseId" | "quizId" | "title" | "durationMinutes" | "questionIds">,
  core: AppData,
): ExamBlueprintValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const course = core.courses.find((item) => item.id === blueprint.courseId);
  const quiz = core.quizzes.find((item) => item.id === blueprint.quizId);
  if (!course) errors.push("The selected course no longer exists.");
  if (!quiz) errors.push("The selected quiz no longer exists.");
  if (quiz && quiz.courseId && quiz.courseId !== blueprint.courseId) {
    errors.push("The selected quiz belongs to a different course.");
  }
  if (!blueprint.title.trim()) errors.push("An exam title is required.");
  if (
    !Number.isFinite(blueprint.durationMinutes) ||
    blueprint.durationMinutes < 1 ||
    blueprint.durationMinutes > 240
  ) {
    errors.push("Duration must be between 1 and 240 minutes.");
  }

  const requestedIds = Array.from(new Set(blueprint.questionIds));
  const questions = requestedIds
    .map((id) => core.quizQuestions.find((question) => question.id === id))
    .filter((question): question is QuizQuestion => Boolean(question));
  if (questions.length !== requestedIds.length) {
    errors.push("One or more selected questions no longer exist.");
  }
  if (questions.length < 2) errors.push("A frozen exam needs at least two questions.");
  for (const question of questions) {
    if (question.quizId !== blueprint.quizId) {
      errors.push(`Question ${question.id} belongs to another quiz.`);
    }
    if (question.options.length < 2) {
      errors.push(`Question ${question.id} has fewer than two options.`);
    }
    if (
      !Number.isInteger(question.correctIndex) ||
      question.correctIndex < 0 ||
      question.correctIndex >= question.options.length
    ) {
      errors.push(`Question ${question.id} has no valid correct answer.`);
    }
    if ((question.sourceChunkIds ?? []).length === 0) {
      errors.push(`Question ${question.id} has no approved source relationship.`);
    }
  }
  const distinctSourceChunkIds = Array.from(
    new Set(questions.flatMap((question) => question.sourceChunkIds ?? [])),
  );
  const existingChunkIds = new Set(core.materialChunks.map((chunk) => chunk.id));
  const missingSources = distinctSourceChunkIds.filter((id) => !existingChunkIds.has(id));
  if (missingSources.length > 0) {
    errors.push(`${missingSources.length} referenced source chunk(s) no longer exist.`);
  }
  if (distinctSourceChunkIds.length < questions.length) {
    warnings.push("Several questions rely on the same source chunk; coverage may be narrow.");
  }
  return {
    ok: errors.length === 0,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
    questions,
    distinctSourceChunkIds,
  };
}

export function freezeExamQuestions(
  questions: QuizQuestion[],
  seed: string,
): FrozenExamQuestion[] {
  return deterministicShuffle(
    questions.map((question) => ({
      questionId: question.id,
      quizId: question.quizId,
      prompt: question.prompt,
      options: question.options.slice(),
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      sourceChunkIds: Array.from(new Set(question.sourceChunkIds ?? [])),
    })),
    seed,
  );
}

export function createFrozenExamSession(input: {
  id: string;
  blueprint: ExamBlueprint;
  questions: QuizQuestion[];
  startedAt: number;
}): ExamSession {
  const questions = freezeExamQuestions(input.questions, input.id);
  return {
    id: input.id,
    blueprintId: input.blueprint.id,
    courseId: input.blueprint.courseId,
    quizId: input.blueprint.quizId,
    title: input.blueprint.title,
    startedAt: input.startedAt,
    deadlineAt: input.startedAt + input.blueprint.durationMinutes * 60_000,
    status: "active",
    questions,
    answers: {},
    currentQuestionId: questions[0]?.questionId,
  };
}

export function answerExamQuestion(
  session: ExamSession,
  questionId: string,
  selectedIndex: number,
  now = Date.now(),
): ExamSession {
  if (session.status !== "active") throw new Error("The exam is no longer active.");
  if (now >= session.deadlineAt) throw new Error("The exam deadline has passed.");
  const question = session.questions.find((item) => item.questionId === questionId);
  if (!question) throw new Error("The frozen question is not part of this exam.");
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= question.options.length) {
    throw new Error("The selected option is invalid.");
  }
  return {
    ...session,
    answers: { ...session.answers, [questionId]: selectedIndex },
    currentQuestionId: questionId,
  };
}

export function submitExamSession(
  session: ExamSession,
  submittedAt = Date.now(),
): ExamSession {
  if (session.status !== "active") return session;
  const questionResults = session.questions.map<ExamQuestionResult>((question) => {
    const selectedIndex = session.answers[question.questionId];
    const unanswered = !Number.isInteger(selectedIndex);
    return {
      questionId: question.questionId,
      selectedIndex: unanswered ? undefined : selectedIndex,
      correctIndex: question.correctIndex,
      correct: !unanswered && selectedIndex === question.correctIndex,
      unanswered,
    };
  });
  const correctCount = questionResults.filter((item) => item.correct).length;
  const answeredCount = questionResults.filter((item) => !item.unanswered).length;
  const total = questionResults.length;
  return {
    ...session,
    status: "submitted",
    result: {
      submittedAt,
      timedOut: submittedAt >= session.deadlineAt,
      score: total > 0 ? Math.round((correctCount / total) * 100) : 0,
      correctCount,
      answeredCount,
      unansweredCount: total - answeredCount,
      total,
      questions: questionResults,
    },
  };
}

export function normalizeExamEngineData(raw: unknown): ExamEngineData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyExamEngineData();
  const object = raw as Record<string, unknown>;
  const blueprints = Array.isArray(object.blueprints)
    ? object.blueprints
        .map(normalizeBlueprint)
        .filter((value): value is ExamBlueprint => Boolean(value))
    : [];
  const sessions = Array.isArray(object.sessions)
    ? object.sessions.map(normalizeSession).filter((value): value is ExamSession => Boolean(value))
    : [];
  return { version: 1, blueprints, sessions };
}

function normalizeBlueprint(raw: unknown): ExamBlueprint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = text(value.id);
  const courseId = text(value.courseId);
  const quizId = text(value.quizId);
  const title = text(value.title).trim();
  if (!id || !courseId || !quizId || !title) return null;
  return {
    id,
    courseId,
    quizId,
    title: title.slice(0, 240),
    durationMinutes: clampInteger(value.durationMinutes, 1, 240, 60),
    questionIds: stringArray(value.questionIds),
    createdAt: finiteNumber(value.createdAt, Date.now()),
    updatedAt: finiteNumber(value.updatedAt, Date.now()),
  };
}

function normalizeSession(raw: unknown): ExamSession | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = text(value.id);
  const blueprintId = text(value.blueprintId);
  const courseId = text(value.courseId);
  const quizId = text(value.quizId);
  const title = text(value.title).trim();
  const status = text(value.status) as ExamSessionStatus;
  if (
    !id ||
    !blueprintId ||
    !courseId ||
    !quizId ||
    !title ||
    !["active", "submitted", "abandoned"].includes(status)
  ) {
    return null;
  }
  const questions = Array.isArray(value.questions)
    ? value.questions
        .map(normalizeFrozenQuestion)
        .filter((question): question is FrozenExamQuestion => Boolean(question))
    : [];
  if (questions.length === 0) return null;
  const answers = normalizeAnswers(value.answers, questions);
  const result = normalizeResult(value.result, questions);
  return {
    id,
    blueprintId,
    courseId,
    quizId,
    title: title.slice(0, 240),
    startedAt: finiteNumber(value.startedAt, Date.now()),
    deadlineAt: finiteNumber(value.deadlineAt, Date.now()),
    status: status === "submitted" && !result ? "active" : status,
    questions,
    answers,
    currentQuestionId:
      questions.some((question) => question.questionId === text(value.currentQuestionId))
        ? text(value.currentQuestionId)
        : questions[0]?.questionId,
    result,
  };
}

function normalizeFrozenQuestion(raw: unknown): FrozenExamQuestion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const questionId = text(value.questionId);
  const quizId = text(value.quizId);
  const prompt = text(value.prompt).trim();
  const options = stringArray(value.options);
  const correctIndex = clampInteger(value.correctIndex, 0, Math.max(0, options.length - 1), -1);
  if (!questionId || !quizId || !prompt || options.length < 2 || correctIndex < 0) return null;
  return {
    questionId,
    quizId,
    prompt: prompt.slice(0, 4_000),
    options,
    correctIndex,
    explanation: optionalText(value.explanation),
    sourceChunkIds: stringArray(value.sourceChunkIds),
  };
}

function normalizeAnswers(
  raw: unknown,
  questions: FrozenExamQuestion[],
): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const object = raw as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const question of questions) {
    const selected = object[question.questionId];
    if (
      typeof selected === "number" &&
      Number.isInteger(selected) &&
      selected >= 0 &&
      selected < question.options.length
    ) {
      result[question.questionId] = selected;
    }
  }
  return result;
}

function normalizeResult(
  raw: unknown,
  questions: FrozenExamQuestion[],
): ExamResult | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  const questionResults = Array.isArray(value.questions)
    ? value.questions
        .map((item) => normalizeQuestionResult(item, questions))
        .filter((item): item is ExamQuestionResult => Boolean(item))
    : [];
  if (questionResults.length !== questions.length) return undefined;
  const correctCount = questionResults.filter((item) => item.correct).length;
  const answeredCount = questionResults.filter((item) => !item.unanswered).length;
  return {
    submittedAt: finiteNumber(value.submittedAt, Date.now()),
    timedOut: value.timedOut === true,
    score: clampInteger(value.score, 0, 100, 0),
    correctCount,
    answeredCount,
    unansweredCount: questions.length - answeredCount,
    total: questions.length,
    questions: questionResults,
    quizAttemptId: optionalText(value.quizAttemptId),
  };
}

function normalizeQuestionResult(
  raw: unknown,
  questions: FrozenExamQuestion[],
): ExamQuestionResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const questionId = text(value.questionId);
  const question = questions.find((item) => item.questionId === questionId);
  if (!question) return null;
  const selectedIndex = value.unanswered === true
    ? undefined
    : clampInteger(value.selectedIndex, 0, question.options.length - 1, -1);
  const unanswered = selectedIndex === undefined || selectedIndex < 0;
  return {
    questionId,
    selectedIndex: unanswered ? undefined : selectedIndex,
    correctIndex: question.correctIndex,
    correct: !unanswered && selectedIndex === question.correctIndex,
    unanswered,
  };
}

function deterministicShuffle<T>(items: T[], seed: string): T[] {
  const output = items.slice();
  let state = hashSeed(seed);
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state % (index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string | undefined {
  const result = text(value).trim();
  return result || undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      )
    : [];
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}
