import { parseGoldenQuizFeedback } from "./golden-quiz";
import type { Quiz, QuizQuestion } from "./store";

export const GOLDEN_QUIZ_QUALITY_VERSION = "golden-quiz-quality-v1";
export const GOLDEN_QUIZ_REVIEW_STORAGE_KEY = "lamdan.goldenQuizReviews.v1";

export type GoldenQuizIssueSeverity = "error" | "warning" | "manual";
export type GoldenQuizReviewDecision = "approve" | "reject" | "needs_edit";
export type GoldenQuizReviewCategory =
  | "clarity"
  | "distractorPlausibility"
  | "factualCorrectness"
  | "rationaleQuality"
  | "translationQuality"
  | "difficulty"
  | "sourceSupport";
export type GoldenQuizAutomaticCategory =
  | "structure"
  | "sourceSupport"
  | "distractors"
  | "rationales"
  | "translation"
  | "memoryHint"
  | "answerBalance";

export interface GoldenQuizQualitySource {
  id: string;
  text: string;
}

export interface GoldenQuizQualityIssue {
  code: string;
  severity: GoldenQuizIssueSeverity;
  message: string;
  questionId?: string;
  optionIndex?: number;
}

export interface GoldenQuizCategoryScore {
  category: GoldenQuizAutomaticCategory;
  score: number;
  passed: number;
  total: number;
}

export interface GoldenQuizQuestionQuality {
  questionId: string;
  score: number;
  categories: GoldenQuizCategoryScore[];
  issues: GoldenQuizQualityIssue[];
}

export interface GoldenQuizQualityReport {
  version: typeof GOLDEN_QUIZ_QUALITY_VERSION;
  quizId: string;
  score: number;
  pass: boolean;
  categories: GoldenQuizCategoryScore[];
  questions: GoldenQuizQuestionQuality[];
  issues: GoldenQuizQualityIssue[];
  generatedAt: number;
}

export interface GoldenQuizManualReview {
  quizId: string;
  questionId: string;
  decision: GoldenQuizReviewDecision;
  scores: Record<GoldenQuizReviewCategory, number>;
  comment: string;
  reviewedAt: number;
}

export interface GoldenQuizEvaluationCandidate {
  version: typeof GOLDEN_QUIZ_QUALITY_VERSION;
  id: string;
  quiz: Pick<Quiz, "id" | "title" | "courseId" | "topicId" | "materialId">;
  questions: QuizQuestion[];
  sources: GoldenQuizQualitySource[];
  automaticReport: GoldenQuizQualityReport;
  manualReviews: GoldenQuizManualReview[];
  exportedAt: string;
}

interface CheckAccumulator {
  category: GoldenQuizAutomaticCategory;
  automaticPass: boolean;
}

const REVIEW_CATEGORIES: GoldenQuizReviewCategory[] = [
  "clarity",
  "distractorPlausibility",
  "factualCorrectness",
  "rationaleQuality",
  "translationQuality",
  "difficulty",
  "sourceSupport",
];

const FORBIDDEN_OPTION_PATTERNS = [
  /all of the above/i,
  /none of the above/i,
  /все перечислен/i,
  /ничего из перечислен/i,
  /כל התשובות נכונות/i,
  /אף תשובה אינה נכונה/i,
];
const GENERIC_RATIONALES = [
  /^incorrect\.?$/i,
  /^wrong\.?$/i,
  /^неверно\.?$/i,
  /^неправильно\.?$/i,
  /^לא נכון\.?$/i,
  /^שגוי\.?$/i,
];

export function evaluateGoldenQuizQuality(input: {
  quizId: string;
  questions: QuizQuestion[];
  sources: GoldenQuizQualitySource[];
  requireRussianTranslation?: boolean;
}): GoldenQuizQualityReport {
  const sourceById = new Map(input.sources.map((source) => [source.id, source.text]));
  const questions = input.questions.map((question) =>
    evaluateQuestion(question, sourceById, input.requireRussianTranslation === true),
  );
  const categories = mergeCategoryScores(questions.flatMap((question) => question.categories));
  const issues = questions.flatMap((question) => question.issues);
  const score = weightedCategoryScore(categories);
  return {
    version: GOLDEN_QUIZ_QUALITY_VERSION,
    quizId: input.quizId,
    score,
    pass:
      questions.length > 0 &&
      issues.every((issue) => issue.severity !== "error") &&
      categories.every((category) => category.score >= categoryThreshold(category.category)) &&
      score >= 0.86,
    categories,
    questions,
    issues,
    generatedAt: Date.now(),
  };
}

export function createGoldenQuizEvaluationCandidate(input: {
  quiz: Quiz;
  questions: QuizQuestion[];
  sources: GoldenQuizQualitySource[];
  requireRussianTranslation?: boolean;
}): GoldenQuizEvaluationCandidate {
  return {
    version: GOLDEN_QUIZ_QUALITY_VERSION,
    id: `golden_candidate_${input.quiz.id}_${Date.now()}`,
    quiz: {
      id: input.quiz.id,
      title: input.quiz.title,
      courseId: input.quiz.courseId,
      topicId: input.quiz.topicId,
      materialId: input.quiz.materialId,
    },
    questions: deepClone(input.questions),
    sources: input.sources.map((source) => ({ ...source })),
    automaticReport: evaluateGoldenQuizQuality({
      quizId: input.quiz.id,
      questions: input.questions,
      sources: input.sources,
      requireRussianTranslation: input.requireRussianTranslation,
    }),
    manualReviews: loadGoldenQuizManualReviews(input.quiz.id),
    exportedAt: new Date().toISOString(),
  };
}

export function defaultGoldenQuizManualReview(
  quizId: string,
  questionId: string,
): GoldenQuizManualReview {
  return {
    quizId,
    questionId,
    decision: "needs_edit",
    scores: Object.fromEntries(REVIEW_CATEGORIES.map((category) => [category, 3])) as Record<
      GoldenQuizReviewCategory,
      number
    >,
    comment: "",
    reviewedAt: Date.now(),
  };
}

export function loadGoldenQuizManualReviews(quizId?: string): GoldenQuizManualReview[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(GOLDEN_QUIZ_REVIEW_STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    const reviews = value.filter(isManualReview).map(normalizeManualReview);
    return quizId ? reviews.filter((review) => review.quizId === quizId) : reviews;
  } catch {
    return [];
  }
}

export function saveGoldenQuizManualReview(review: GoldenQuizManualReview): void {
  if (typeof localStorage === "undefined") return;
  const normalized = normalizeManualReview(review);
  const next = loadGoldenQuizManualReviews().filter(
    (item) => !(item.quizId === normalized.quizId && item.questionId === normalized.questionId),
  );
  next.push({ ...normalized, reviewedAt: Date.now() });
  localStorage.setItem(GOLDEN_QUIZ_REVIEW_STORAGE_KEY, JSON.stringify(next));
}

export function downloadGoldenQuizCandidate(candidate: GoldenQuizEvaluationCandidate): void {
  const blob = new Blob([JSON.stringify(candidate, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(candidate.quiz.title || candidate.quiz.id)}-quality-candidate.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function evaluateQuestion(
  question: QuizQuestion,
  sourceById: Map<string, string>,
  requireRussianTranslation: boolean,
): GoldenQuizQuestionQuality {
  const checks: CheckAccumulator[] = [];
  const issues: GoldenQuizQualityIssue[] = [];
  const add = (
    category: GoldenQuizAutomaticCategory,
    passed: boolean,
    code: string,
    severity: GoldenQuizIssueSeverity,
    message: string,
    optionIndex?: number,
  ) => {
    // Manual-only heuristics create reviewer work without pretending to be deterministic failures.
    checks.push({ category, automaticPass: severity === "manual" ? true : passed });
    if (!passed) {
      issues.push({ code, severity, message, questionId: question.id, optionIndex });
    }
  };

  const options = Array.isArray(question.options) ? question.options : [];
  const normalizedOptions = options.map(normalizeComparable);
  const feedback = parseGoldenQuizFeedback(question.explanation, options.length);
  const correctAnswer = options[question.correctIndex] ?? "";
  const sourceChunkIds = question.sourceChunkIds ?? [];
  const sourceText = sourceChunkIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter((value): value is string => Boolean(value))
    .join("\n");

  add("structure", options.length === 4, "option_count", "error", "Question must have exactly four options.");
  add("structure", normalizedOptions.filter(Boolean).length === 4, "empty_option", "error", "Every option must contain text.");
  add("structure", new Set(normalizedOptions).size === 4, "duplicate_option", "error", "Options must be unique after normalization.");
  add(
    "structure",
    Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < 4,
    "correct_index",
    "error",
    "Correct answer index is invalid.",
  );
  add("structure", question.prompt.trim().length >= 8, "prompt_too_short", "warning", "Question prompt is too short to be unambiguous.");

  add("sourceSupport", sourceChunkIds.length > 0, "missing_citation", "error", "Question has no source chunk reference.");
  add(
    "sourceSupport",
    sourceChunkIds.every((sourceId) => sourceById.has(sourceId)),
    "unknown_citation",
    "error",
    "Question references a source chunk that does not exist.",
  );
  add("sourceSupport", sourceText.trim().length > 0, "empty_source_scope", "error", "Referenced source text is unavailable.");
  const answerTokens = meaningfulTokens(correctAnswer);
  add(
    "sourceSupport",
    answerTokens.length === 0 || answerTokens.some((token) => normalizeComparable(sourceText).includes(token)),
    "answer_not_observable",
    "manual",
    "The correct answer has weak lexical support in the selected sources; verify it manually.",
  );
  const groundedNumberScope = [
    question.prompt,
    correctAnswer,
    feedback.correctExplanation,
    feedback.optionRationales[question.correctIndex] ?? "",
  ].join(" ");
  const sourceNumbers = new Set(extractNumbers(sourceText));
  add(
    "sourceSupport",
    extractNumbers(groundedNumberScope).every((value) => sourceNumbers.has(value)),
    "unsupported_number",
    "error",
    "A date or number in the grounded answer scope is absent from selected sources.",
  );

  options.forEach((option, optionIndex) => {
    add(
      "distractors",
      !FORBIDDEN_OPTION_PATTERNS.some((pattern) => pattern.test(option)),
      "forbidden_meta_option",
      "error",
      "Avoid all/none-of-the-above options unless explicitly allowed.",
      optionIndex,
    );
    const normalized = normalizeComparable(option);
    add(
      "distractors",
      normalized.length >= 3 && !/^[a-dא-ד]$/i.test(normalized),
      "junk_option",
      "error",
      "Option looks like placeholder or junk text.",
      optionIndex,
    );
  });
  const lengths = options.map((option) => option.trim().length).filter((length) => length > 0);
  const median = medianValue(lengths);
  add(
    "distractors",
    median === 0 || correctAnswer.trim().length <= median * 1.8,
    "correct_answer_length_clue",
    "warning",
    "Correct answer is much longer than the distractors.",
  );
  add(
    "distractors",
    options.filter((option) => sameSurfaceCategory(option, correctAnswer)).length >= 3,
    "category_mismatch",
    "manual",
    "Some distractors may not belong to the same semantic category as the answer.",
  );

  add("rationales", feedback.optionRationales.length === 4, "rationale_count", "error", "Every option needs an aligned rationale.");
  feedback.optionRationales.forEach((rationale, optionIndex) => {
    add(
      "rationales",
      rationale.trim().length >= 12 && !GENERIC_RATIONALES.some((pattern) => pattern.test(rationale.trim())),
      "weak_rationale",
      "warning",
      "Rationale must explain this exact option rather than only label it incorrect.",
      optionIndex,
    );
  });
  add("rationales", feedback.correctExplanation.trim().length >= 16, "weak_correct_explanation", "warning", "Correct-answer explanation is too short.");
  add(
    "rationales",
    !contradictionHeuristic(feedback.optionRationales[question.correctIndex] ?? ""),
    "correct_rationale_contradiction",
    "error",
    "The rationale aligned with the correct option appears to call it wrong.",
  );

  const translationRequired = requireRussianTranslation || containsHebrew(question.prompt);
  add("translation", !translationRequired || Boolean(feedback.promptTranslation?.trim()), "missing_prompt_translation", "warning", "Hebrew-first question needs a Russian prompt translation.");
  add(
    "translation",
    !translationRequired || feedback.optionTranslations?.filter((value) => value.trim()).length === 4,
    "missing_option_translation",
    "warning",
    "Hebrew-first question needs four Russian option translations.",
  );
  if (feedback.optionTranslations?.length === 4) {
    add(
      "translation",
      !looksLikeNegationMismatch(
        correctAnswer,
        feedback.optionTranslations[question.correctIndex] ?? "",
      ),
      "translation_meaning_risk",
      "manual",
      "Correct-option translation may change polarity or meaning; verify manually.",
    );
  }

  add("memoryHint", feedback.memoryHint.trim().length >= 8, "missing_memory_hint", "warning", "Memory hint is missing or too short.");
  add("memoryHint", !hintRevealsAnswer(feedback.memoryHint, correctAnswer), "hint_reveals_answer", "warning", "Memory hint reveals the correct answer too literally.");
  add("answerBalance", question.correctIndex >= 0 && question.correctIndex < 4, "answer_position_invalid", "error", "Correct answer position cannot be analyzed.");

  const categories = categoryScores(checks);
  return {
    questionId: question.id,
    score: weightedCategoryScore(categories),
    categories,
    issues,
  };
}

function categoryScores(checks: CheckAccumulator[]): GoldenQuizCategoryScore[] {
  return automaticCategories().map((category) => {
    const values = checks.filter((check) => check.category === category);
    const passed = values.filter((check) => check.automaticPass).length;
    return { category, passed, total: values.length, score: values.length ? passed / values.length : 1 };
  });
}

function mergeCategoryScores(scores: GoldenQuizCategoryScore[]): GoldenQuizCategoryScore[] {
  return automaticCategories().map((category) => {
    const selected = scores.filter((score) => score.category === category);
    const passed = selected.reduce((sum, score) => sum + score.passed, 0);
    const total = selected.reduce((sum, score) => sum + score.total, 0);
    return { category, passed, total, score: total ? passed / total : 1 };
  });
}

function automaticCategories(): GoldenQuizAutomaticCategory[] {
  return [
    "structure",
    "sourceSupport",
    "distractors",
    "rationales",
    "translation",
    "memoryHint",
    "answerBalance",
  ];
}

function weightedCategoryScore(categories: GoldenQuizCategoryScore[]): number {
  const weights: Record<GoldenQuizAutomaticCategory, number> = {
    structure: 2,
    sourceSupport: 2.5,
    distractors: 2,
    rationales: 1.5,
    translation: 1,
    memoryHint: 0.75,
    answerBalance: 0.5,
  };
  const total = categories.reduce((sum, category) => sum + weights[category.category], 0);
  return categories.reduce((sum, category) => sum + category.score * weights[category.category], 0) / total;
}

function categoryThreshold(category: GoldenQuizAutomaticCategory): number {
  if (category === "structure" || category === "sourceSupport") return 1;
  if (category === "distractors" || category === "rationales") return 0.85;
  return 0.75;
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(value: string): string[] {
  return normalizeComparable(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function extractNumbers(value: string): string[] {
  return Array.from(new Set(value.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []));
}

function sameSurfaceCategory(left: string, right: string): boolean {
  const leftNumber = /^[-+]?\d/.test(left.trim());
  const rightNumber = /^[-+]?\d/.test(right.trim());
  if (leftNumber || rightNumber) return leftNumber === rightNumber;
  return (
    Math.abs(meaningfulTokens(left).length - meaningfulTokens(right).length) <=
    Math.max(3, Math.ceil(meaningfulTokens(right).length * 0.8))
  );
}

function contradictionHeuristic(value: string): boolean {
  return /(?:incorrect|wrong|неверн|неправильн|לא נכון|שגוי)/i.test(value);
}

function hintRevealsAnswer(hint: string, answer: string): boolean {
  const answerTokens = meaningfulTokens(answer).filter((token) => token.length >= 4);
  if (answerTokens.length === 0) return false;
  const normalizedHint = normalizeComparable(hint);
  return answerTokens.filter((token) => normalizedHint.includes(token)).length / answerTokens.length >= 0.8;
}

function containsHebrew(value: string): boolean {
  return /[\u0590-\u05ff]/.test(value);
}

function looksLikeNegationMismatch(source: string, translation: string): boolean {
  const sourceNegated = /(?:לא|אינו|אינה|אין|not|never|no\b)/i.test(source);
  const translatedNegated = /(?:не\b|нет\b|никогда|без\b|not|never|no\b)/i.test(translation);
  return sourceNegated !== translatedNegated;
}

function medianValue(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isManualReview(value: unknown): value is GoldenQuizManualReview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const review = value as Partial<GoldenQuizManualReview>;
  return (
    typeof review.quizId === "string" &&
    typeof review.questionId === "string" &&
    (review.decision === "approve" || review.decision === "reject" || review.decision === "needs_edit") &&
    Boolean(review.scores && typeof review.scores === "object")
  );
}

function normalizeManualReview(review: GoldenQuizManualReview): GoldenQuizManualReview {
  return {
    quizId: review.quizId,
    questionId: review.questionId,
    decision: review.decision,
    scores: Object.fromEntries(
      REVIEW_CATEGORIES.map((category) => [category, clampReviewScore(review.scores[category])]),
    ) as Record<GoldenQuizReviewCategory, number>,
    comment: typeof review.comment === "string" ? review.comment.slice(0, 4000) : "",
    reviewedAt: Number.isFinite(review.reviewedAt) ? review.reviewedAt : Date.now(),
  };
}

function clampReviewScore(value: unknown): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 3;
  return Math.max(1, Math.min(5, parsed));
}

function safeFileName(value: string): string {
  return (
    value
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "golden-quiz"
  );
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "what",
  "which",
  "как",
  "что",
  "для",
  "это",
  "или",
  "של",
  "את",
  "על",
  "מה",
  "איזה",
]);
