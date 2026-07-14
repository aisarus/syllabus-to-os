import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Gauge,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { parseGoldenQuizFeedback } from "@/lib/golden-quiz";
import {
  createGoldenQuizEvaluationCandidate,
  defaultGoldenQuizManualReview,
  downloadGoldenQuizCandidate,
  evaluateGoldenQuizQuality,
  loadGoldenQuizManualReviews,
  saveGoldenQuizManualReview,
  type GoldenQuizManualReview,
  type GoldenQuizReviewCategory,
  type GoldenQuizReviewDecision,
} from "@/lib/golden-quiz-quality";
import { useData } from "@/lib/store";

const REVIEW_CATEGORIES: GoldenQuizReviewCategory[] = [
  "clarity",
  "distractorPlausibility",
  "factualCorrectness",
  "rationaleQuality",
  "translationQuality",
  "difficulty",
  "sourceSupport",
];

export function GoldenQuizQualityReview({ quizId }: { quizId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const navigate = useNavigate();
  const quiz = data.quizzes.find((item) => item.id === quizId);
  const questions = data.quizQuestions.filter((question) => question.quizId === quizId);
  const sourceIds = Array.from(new Set(questions.flatMap((question) => question.sourceChunkIds)));
  const sources = sourceIds
    .map((sourceId) => data.materialChunks.find((chunk) => chunk.id === sourceId))
    .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk))
    .map((chunk) => ({ id: chunk.id, text: chunk.text }));
  const report = useMemo(
    () =>
      evaluateGoldenQuizQuality({
        quizId,
        questions,
        sources,
        requireRussianTranslation: lang === "ru",
      }),
    [lang, questions, quizId, sources],
  );
  const [reviews, setReviews] = useState<Record<string, GoldenQuizManualReview>>(() =>
    Object.fromEntries(
      loadGoldenQuizManualReviews(quizId).map((review) => [review.questionId, review]),
    ),
  );
  const [activeQuestionId, setActiveQuestionId] = useState(questions[0]?.id ?? "");
  const activeQuestion = questions.find((question) => question.id === activeQuestionId);
  const activeReport = report.questions.find(
    (question) => question.questionId === activeQuestionId,
  );
  const review = activeQuestion
    ? (reviews[activeQuestion.id] ?? defaultGoldenQuizManualReview(quizId, activeQuestion.id))
    : undefined;

  if (!quiz) {
    return (
      <div className="mx-auto max-w-5xl">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/quizzes" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {isRu ? "К тестам" : "Back to quizzes"}
        </Button>
        <div className="mt-4 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {isRu ? "Тест не найден" : "Quiz not found"}
        </div>
      </div>
    );
  }

  const updateReview = (patch: Partial<GoldenQuizManualReview>) => {
    if (!activeQuestion || !review) return;
    setReviews((current) => ({
      ...current,
      [activeQuestion.id]: { ...review, ...patch, reviewedAt: Date.now() },
    }));
  };

  const saveReview = () => {
    if (!activeQuestion || !review) return;
    saveGoldenQuizManualReview(review);
    setReviews((current) => ({ ...current, [activeQuestion.id]: review }));
    toast.success(isRu ? "Ручная оценка сохранена" : "Manual review saved");
  };

  const exportCandidate = () => {
    downloadGoldenQuizCandidate(
      createGoldenQuizEvaluationCandidate({
        quiz,
        questions,
        sources,
        requireRussianTranslation: lang === "ru",
      }),
    );
    toast.success(
      isRu
        ? "Кандидат выгружен — после проверки его можно добавить в permanent fixtures"
        : "Candidate exported and can be promoted to permanent fixtures after review",
    );
  };

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            to="/app/quizzes/$quizId"
            params={{ quizId }}
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 me-1" />
            {isRu ? "Назад к тесту" : "Back to quiz"}
          </Link>
          <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-[0.17em] text-primary">
            <ShieldCheck className="h-4 w-4" />
            {isRu ? "Проверка качества" : "Quality review"}
          </div>
          <h1 className="mt-2 font-serif text-3xl font-semibold">{quiz.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {isRu
              ? "Автоматические проверки находят структурные и source-grounding проблемы. Смысл, правдоподобие и фактическую точность подтверждает человек."
              : "Automatic checks catch structural and source-grounding problems. A human confirms meaning, plausibility, and factual correctness."}
          </p>
        </div>
        <Button variant="outline" onClick={exportCandidate} disabled={questions.length === 0}>
          <Download className="h-4 w-4 me-1" />
          {isRu ? "Выгрузить candidate" : "Export candidate"}
        </Button>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={isRu ? "Итоговый автоматический балл" : "Automatic score"}
          value={`${Math.round(report.score * 100)}%`}
          tone={report.pass ? "good" : "warn"}
        />
        <MetricCard
          label={isRu ? "Критические ошибки" : "Critical errors"}
          value={String(report.issues.filter((issue) => issue.severity === "error").length)}
          tone={report.issues.some((issue) => issue.severity === "error") ? "bad" : "good"}
        />
        <MetricCard
          label={isRu ? "Нужна ручная проверка" : "Manual checks"}
          value={String(report.issues.filter((issue) => issue.severity === "manual").length)}
          tone="neutral"
        />
        <MetricCard
          label={isRu ? "Проверено вручную" : "Manually reviewed"}
          value={`${Object.keys(reviews).length}/${questions.length}`}
          tone="neutral"
        />
      </section>

      <section className="mt-4 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">{isRu ? "Категории" : "Categories"}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {report.categories.map((category) => (
            <div
              key={category.category}
              className="rounded-md border border-border bg-background p-3"
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {categoryLabel(category.category, isRu)}
              </div>
              <div className="mt-1 text-xl font-semibold">{Math.round(category.score * 100)}%</div>
              <div className="text-[10px] text-muted-foreground">
                {category.passed}/{category.total}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-surface p-3">
          <h2 className="px-1 text-sm font-semibold">{isRu ? "Вопросы" : "Questions"}</h2>
          <div className="mt-3 max-h-[70svh] space-y-2 overflow-y-auto">
            {questions.map((question, index) => {
              const questionReport = report.questions.find(
                (entry) => entry.questionId === question.id,
              );
              const savedReview = reviews[question.id];
              return (
                <button
                  key={question.id}
                  type="button"
                  className={`w-full rounded-md border p-3 text-start ${
                    question.id === activeQuestionId
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-accent/30"
                  }`}
                  onClick={() => setActiveQuestionId(question.id)}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {isRu ? "Вопрос" : "Question"} {index + 1}
                    </span>
                    <span>{Math.round((questionReport?.score ?? 0) * 100)}%</span>
                  </div>
                  <strong dir="auto" className="mt-1 line-clamp-3 block text-xs leading-5">
                    {question.prompt}
                  </strong>
                  <div className="mt-2 flex items-center gap-1 text-[10px]">
                    {questionReport?.issues.some((issue) => issue.severity === "error") ? (
                      <span className="inline-flex items-center text-red-300">
                        <XCircle className="h-3 w-3 me-1" /> {isRu ? "ошибка" : "error"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-emerald-300">
                        <CheckCircle2 className="h-3 w-3 me-1" />{" "}
                        {isRu ? "структура ок" : "structure ok"}
                      </span>
                    )}
                    {savedReview && (
                      <span className="ms-auto">{decisionLabel(savedReview.decision, isRu)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {activeQuestion && review ? (
          <main className="space-y-4">
            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 dir="auto" className="max-w-3xl font-serif text-2xl font-semibold leading-9">
                  {activeQuestion.prompt}
                </h2>
                <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                  {Math.round((activeReport?.score ?? 0) * 100)}%
                </span>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {activeQuestion.options.map((option, index) => (
                  <div
                    key={`${option}_${index}`}
                    className={`rounded-md border p-3 text-sm ${
                      index === activeQuestion.correctIndex
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <span className="me-2 text-xs font-semibold">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <span dir="auto">{option}</span>
                  </div>
                ))}
              </div>
              <FeedbackPreview question={activeQuestion} isRu={isRu} />
            </section>

            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold">
                {isRu ? "Автоматические замечания" : "Automatic findings"}
              </h2>
              {activeReport?.issues.length ? (
                <div className="mt-3 space-y-2">
                  {activeReport.issues.map((issue, index) => (
                    <div
                      key={`${issue.code}_${index}`}
                      className={`flex gap-2 rounded-md border p-3 text-xs ${
                        issue.severity === "error"
                          ? "border-red-500/25 bg-red-500/5 text-red-100"
                          : issue.severity === "warning"
                            ? "border-yellow-500/25 bg-yellow-500/5 text-yellow-100"
                            : "border-sky-500/25 bg-sky-500/5 text-sky-100"
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <div>
                        <strong>{issue.code}</strong>
                        <p className="mt-0.5 text-muted-foreground">{issue.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-emerald-300">
                  {isRu
                    ? "Автоматические проверки не нашли проблем."
                    : "Automatic checks found no issues."}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">
                  {isRu ? "Ручная рубрика" : "Manual rubric"}
                </h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {REVIEW_CATEGORIES.map((category) => (
                  <label
                    key={category}
                    className="rounded-md border border-border bg-background p-3"
                  >
                    <span className="text-xs font-medium">
                      {reviewCategoryLabel(category, isRu)}
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={review.scores[category]}
                        onChange={(event) =>
                          updateReview({
                            scores: { ...review.scores, [category]: Number(event.target.value) },
                          })
                        }
                      />
                      <strong className="w-4 text-sm">{review.scores[category]}</strong>
                    </div>
                  </label>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <Select
                  value={review.decision}
                  onValueChange={(value) =>
                    updateReview({ decision: value as GoldenQuizReviewDecision })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approve">{isRu ? "Одобрить" : "Approve"}</SelectItem>
                    <SelectItem value="needs_edit">
                      {isRu ? "Нужно исправить" : "Needs edit"}
                    </SelectItem>
                    <SelectItem value="reject">{isRu ? "Отклонить" : "Reject"}</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  className="min-h-[110px] resize-y"
                  value={review.comment}
                  onChange={(event) => updateReview({ comment: event.target.value })}
                  placeholder={isRu ? "Комментарий проверяющего" : "Reviewer comment"}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={saveReview}>
                  <Save className="h-4 w-4 me-1" />
                  {isRu ? "Сохранить оценку" : "Save review"}
                </Button>
              </div>
            </section>
          </main>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            {isRu ? "В тесте нет вопросов" : "This quiz has no questions"}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackPreview({
  question,
  isRu,
}: {
  question: Parameters<typeof parseGoldenQuizFeedback>[0] extends never ? never : any;
  isRu: boolean;
}) {
  const feedback = parseGoldenQuizFeedback(question.explanation, question.options.length);
  return (
    <div className="mt-4 space-y-2 rounded-md border border-border bg-background p-4 text-xs leading-5">
      <p>
        <strong>{isRu ? "Объяснение" : "Explanation"}:</strong> {feedback.correctExplanation || "—"}
      </p>
      <p>
        <strong>{isRu ? "Подсказка" : "Hint"}:</strong> {feedback.memoryHint || "—"}
      </p>
      {feedback.promptTranslation && (
        <p dir="auto">
          <strong>{isRu ? "Перевод" : "Translation"}:</strong> {feedback.promptTranslation}
        </p>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-yellow-200"
        : tone === "bad"
          ? "text-red-300"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function categoryLabel(category: string, isRu: boolean): string {
  const labels: Record<string, [string, string]> = {
    structure: ["структура", "structure"],
    sourceSupport: ["источники", "sources"],
    distractors: ["дистракторы", "distractors"],
    rationales: ["разбор", "rationales"],
    translation: ["перевод", "translation"],
    memoryHint: ["подсказка", "memory hint"],
    answerBalance: ["позиции", "answer balance"],
  };
  return (labels[category] ?? [category, category])[isRu ? 0 : 1];
}

function reviewCategoryLabel(category: GoldenQuizReviewCategory, isRu: boolean): string {
  const labels: Record<GoldenQuizReviewCategory, [string, string]> = {
    clarity: ["Ясность вопроса", "Question clarity"],
    distractorPlausibility: ["Правдоподобие дистракторов", "Distractor plausibility"],
    factualCorrectness: ["Фактическая точность", "Factual correctness"],
    rationaleQuality: ["Качество разбора", "Rationale quality"],
    translationQuality: ["Качество перевода", "Translation quality"],
    difficulty: ["Сложность", "Difficulty"],
    sourceSupport: ["Подтверждение источниками", "Source support"],
  };
  return labels[category][isRu ? 0 : 1];
}

function decisionLabel(decision: GoldenQuizReviewDecision, isRu: boolean): string {
  const labels: Record<GoldenQuizReviewDecision, [string, string]> = {
    approve: ["одобрено", "approved"],
    needs_edit: ["нужны правки", "needs edit"],
    reject: ["отклонено", "rejected"],
  };
  return labels[decision][isRu ? 0 : 1];
}
