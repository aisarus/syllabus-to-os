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
  category:
    | "structure"
    | "sourceSupport"
    | "distractors"
    | "rationales"
    | "translation"
    | "memoryHint"
    | "answerBalance";
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
  const questionReports = input.questions.map((question) =>
    evaluateQuestion(question, sourceById, input.requireRussianTranslation === true),
  );
  const categories = mergeCategoryScores(questionReports.flatMap((report) => report.categories));
  const issues = questionReports.flatMap((report) => report.issues);
  const score = weightedCategoryScore(categories);
  const pass =
    input.questions.length > 0 &&
    issues.every((issue) => issue.severity !== "error") &&
    categories.every((category) => category.score >= categoryThreshold(category.category)) &&
    score >= 0.86;
  return {
    version: GOLDEN_QUIZ_QUALITY_VERSION,
    quizId: input.quizId,
    score,
    pass,
    categories,
    questions: questionReports,
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
    questions: JSON.parse(JSON.stringify(input.questions)) as QuizQuestion[],
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
    const parsed = JSON.parse(localStorage.getItem(GOLDEN_QUIZ_REVIEW_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const reviews = parsed.filter(isManualReview).map(normalizeManualReview);
    return quizId ? reviews.filter((review) => review.quizId === quizId) : reviews;
  } catch {
    return [];
  }
}

export function saveGoldenQuizManualReview(review: GoldenQuizManualReview): void {
  if (typeof localStorage === "undefined") return;
  const normalized = normalizeManualReview(review);
  const existing = loadGoldenQuizManualReviews();
  const next = existing.filter(
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
  const issues: GoldenQuizQualityIssue[] = [];
  const checks = new Map<GoldenQuizCategoryScore["category"], boolean[]>();
  const addCheck = (
    category: GoldenQuizCategoryScore["category"],
    pass: boolean,
    code: string,
    severity: GoldenQuizIssueSeverity,
    message: string,
    optionIndex?: number,
  ) => {
    const values = checks.get(category) ?? [];
    values.push(pass);
    checks.set(category, values);
    if (!pass) issues.push({ code, severity, message, questionId: question.id, optionIndex });
  };

  const options = Array.isArray(question.options) ? question.options : [];
  const normalizedOptions = options.map(normalizeComparable);
  const feedback = parseGoldenQuizFeedback(question.explanation, options.length);
  const correctAnswer = options[question.correctIndex] ?? "";
  const supportedSources = question.sourceChunkIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter((text): text is string => Boolean(text));
  const joinedSources = supportedSources.join("\n");

  addCheck("structure", options.length === 4, "option_count", "error", "Question must have exactly four options.");
  addCheck(
    "structure",
    normalizedOptions.filter(Boolean).length === 4,
    "empty_option",
    "error",
    "Every option must contain text.",
  );
  addCheck(
    "structure",
    new Set(normalizedOptions).size === 4,
    "duplicate_option",
    "error",
    "Options must be unique after normalization.",
  );
  addCheck(
    "structure",
    Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < 4,
    "correct_index",
    "error",
    "Correct answer index is invalid.",
  );
  addCheck(
    "structure",
    question.prompt.trim().length >= 8,
    "prompt_too_short",
    "warning",
    "Question prompt is too short to be unambiguous.",
  );

  addCheck(
    "sourceSupport",
    question.sourceChunkIds.length > 0,
    "missing_citation",
    "error",
    "Question has no source chunk reference.",
  );
  addCheck(
    "sourceSupport",
    question.sourceChunkIds.every((sourceId) => sourceById.has(sourceId)),
    "unknown_citation",
    "error",
    "Question references a source chunk that does not exist.",
  );
  addCheck(
    "sourceSupport",
    joinedSources.trim().length > 0,
    "empty_source_scope",
    "error",
    "Referenced source text is unavailable.",
  );
  const answerTokens = meaningfulTokens(correctAnswer);
  addCheck(
    "sourceSupport",
    answerTokens.length === 0 || answerTokens.some((token) => normalizeComparable(joinedSources).includes(token)),
    "answer_not_observable",
    "manual",
    "The correct answer has weak lexical support in the selected sources; verify it manually.",
  );
  const candidateNumbers = extractNumbers(
    [question.prompt, ...options, feedback.correctExplanation, ...feedback.optionRationales].join(" "),
  );
  const sourceNumbers = new Set(extractNumbers(joinedSources));
  addCheck(
    "sourceSupport",
    candidateNumbers.every((number) => sourceNumbers.has(number)),
    "unsupported_number",
    "error",
    "A date or number in the question is absent from its selected sources.",
  );

  options.forEach((option, index) => {
    const normalized = normalizeComparable(option);
    addCheck(
      "distractors",
      !FORBIDDEN_OPTION_PATTERNS.some((pattern) => pattern.test(option)),
      "forbidden_meta_option",
      "error",
      "Avoid all/none-of-the-above options unless explicitly allowed.",
      index,
    );
    addCheck(
      "distractors",
      normalized.length >= 3 && !/^[a-dא-ד]$/i.test(normalized),
      "junk_option",
      "error",
      "Option looks like placeholder or junk text.",
      index,
    );
  });
  const lengths = options.map((option) => option.trim().length).filter((length) => length > 0);
  const median = medianValue(lengths);
  const correctLength = correctAnswer.trim().length;
  addCheck(
    "distractors",
    median === 0 || correctLength <= median * 1.8,
    "correct_answer_length_clue",
    "warning",
    "Correct answer is much longer than the distractors.",
  );
  addCheck(
    "distractors",
    options.filter((option) => sameSurfaceCategory(option, correctAnswer)).length >= 3,
    "category_mismatch",
    "manual",
    "Some distractors may not belong to the same semantic category as the answer.",
  );

  addCheck(
    "rationales",
    feedback.optionRationales.length === 4,
    "rationale_count",
    "error",
    "Every option needs an aligned rationale.",
  );
  feedback.optionRationales.forEach((rationale, index) => {
    addCheck(
      "rationales",
      rationale.trim().length >= 12 && !GENERIC_RATIONALES.some((pattern) => pattern.test(rationale.trim())),
      "weak_rationale",
      "warning",
      "Rationale must explain this exact option rather than only label it incorrect.",
      index,
    );
  });
  addCheck(
    "rationales",
    feedback.correctExplanation.trim().length >= 16,
    "weak_correct_explanation",
    "warning",
    "Correct-answer explanation is too short.",
  );
  addCheck(
    "rationales",
    !contradictionHeuristic(feedback.optionRationales[question.correctIndex] ?? ""),
    "correct_rationale_contradiction",
    "error",
    "The rationale aligned with the correct option appears to call it wrong.",
  );

  const translationRequired = requireRussianTranslation || containsHebrew(question.prompt);
  addCheck(
    "translation",
    !translationRequired || Boolean(feedback.promptTranslation?.trim()),
    "missing_prompt_translation",
    "warning",
    "Hebrew-first question needs a Russian prompt translation.",
  );
  addCheck(
    "translation",
    !translationRequired || feedback.optionTranslations?.filter((value) => value.trim()).length === 4,
    "missing_option_translation",
    "warning",
    "Hebrew-first question needs four Russian option translations.",
  );
  if (feedback.optionTranslations?.length === 4) {
    const translatedCorrect = feedback.optionTranslations[question.correctIndex] ?? "";
    addCheck(
      "translation",
      Boolean(translatedCorrect.trim()) && !looksLikeNegationMismatch(correctAnswer, translatedCorrect),
      "translation_meaning_risk",
      "manual",
      "Correct-option translation may change polarity or meaning; verify manually.",
    );
  }

  addCheck(
    "memoryHint",
    feedback.memoryHint.trim().length >= 8,
    "missing_memory_hint",
    "warning",
    "Memory hint is missing or too short.",
  );
  addCheck(
    "memoryHint",
    !hintRevealsAnswer(feedback.memoryHint, correctAnswer),
    "hint_reveals_answer",
    "warning",
    "Memory hint reveals the correct answer too literally.",
  );

  const correctIndexDistributionSafe = question.correctIndex >= 0 && question.correctIndex < 4;
  addCheck(
    "answerBalance",
    correctIndexDistributionSafe,
    "answer_position_invalid",
    "error",
    "Correct answer position cannot be included in balance analysis.",
  );

  const categories = Array.from(checks.entries()).map(([category, values]) => ({
    category,
    score: proportion(values),
    passed: values.filter(Boolean).length,
    total: values.length,
  }));
  return {
    questionId: question.id,
    score: weightedCategoryScore(categories),
    categories,
    issues,
  };
}

function mergeCategoryScores(scores: GoldenQuizCategoryScore[]): GoldenQuizCategoryScore[] {
  const categories: GoldenQuizCategoryScore["category"][] = [
    "structure",
    "sourceSupport",
    "distractors",
    "rationales",
    "translation",
    "memoryHint",
    "answerBalance",
  ];
  return categories.map((category) => {
    const selected = scores.filter((score) => score.category === category);
    const passed = selected.reduce((sum, score) => sum + score.passed, 0);
    const total = selected.reduce((sum, score) => sum + score.total, 0);
    return { category, passed, total, score: total > 0 ? passed / total : 1 };
  });
}

function weightedCategoryScore(categories: GoldenQuizCategoryScore[]): number {
  const weights: Record<GoldenQuizCategoryScore["category"], number> = {
    structure: 2,
    sourceSupport: 2.5,
    distractors: 2,
    rationales: 1.5,
    translation: 1,
    memoryHint: 0.75,
    answerBalance: 0.5,
  };
  const total = categories.reduce((sum, category) => sum + weights[category.category], 0);
  if (total === 0) return 0;
  return (
    categories.reduce((sum, category) => sum + category.score * weights[category.category], 0) /
    total
  );
}

function categoryThreshold(category: GoldenQuizCategoryScore["category"]): number {
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
  const leftDate = /\b(?:19|20)\d{2}\b/.test(left);
  const rightDate = /\b(?:19|20)\d{2}\b/.test(right);
  if (leftDate || rightDate) return leftDate === rightDate;
  const leftWords = meaningfulTokens(left).length;
  const rightWords = meaningfulTokens(right).length;
  return Math.abs(leftWords - rightWords) <= Math.max(3, Math.ceil(rightWords * 0.8));
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
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function proportion(values: boolean[]): number {
  return values.length === 0 ? 1 : values.filter(Boolean).length / values.length;
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
    reviewedAt:
      typeof review.reviewedAt === "number" && Number.isFinite(review.reviewedAt)
        ? review.reviewedAt
        : Date.now(),
  };
}

function clampReviewScore(value: unknown): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 3;
  return Math.max(1, Math.min(5, parsed));
}

function safeFileName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "golden-quiz";
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
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
