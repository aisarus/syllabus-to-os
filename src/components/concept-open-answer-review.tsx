import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import type { ConceptEvidenceEvent, ConceptMistakeKind } from "@/lib/concept-evidence";
import { conceptStore, useConceptEvidenceData } from "@/lib/concept-store";
import {
  formatOpenAnswerReviewSummary,
  validateOpenAnswerSaveDraft,
  type OpenAnswerReviewDraft,
} from "@/lib/open-answer-review";
import { reviewOpenAnswer } from "@/lib/open-answer-review-client";
import { useData } from "@/lib/store";

const MISTAKE_OPTIONS: ConceptMistakeKind[] = [
  "retrieval",
  "confusion",
  "application",
  "careless",
  "unclassified",
];

export function ConceptOpenAnswerReview({ courseId }: { courseId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const core = useData();
  const evidenceData = useConceptEvidenceData();
  const course = core.courses.find((item) => item.id === courseId);
  const concepts = evidenceData.concepts.filter((concept) => concept.courseId === courseId);
  const [conceptId, setConceptId] = useState(concepts[0]?.id ?? "");
  const [kind, setKind] = useState<"explanation" | "application">("explanation");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [sourceChunkIds, setSourceChunkIds] = useState<string[]>([]);
  const [review, setReview] = useState<OpenAnswerReviewDraft | null>(null);
  const [outcome, setOutcome] = useState<"success" | "failure">("failure");
  const [mistakeKind, setMistakeKind] = useState<ConceptMistakeKind>("unclassified");
  const [score, setScore] = useState(0);
  const [reviewSummary, setReviewSummary] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [repairOfEvidenceId, setRepairOfEvidenceId] = useState<string | undefined>();

  const concept = concepts.find((item) => item.id === conceptId);
  const chunkById = useMemo(
    () => new Map(core.materialChunks.map((chunk) => [chunk.id, chunk])),
    [core.materialChunks],
  );
  const materialById = useMemo(
    () => new Map(core.materials.map((material) => [material.id, material])),
    [core.materials],
  );
  const conceptChunks = (concept?.sourceChunkIds ?? [])
    .map((id) => chunkById.get(id))
    .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk));
  const openAnswerEvents = evidenceData.evidenceEvents
    .filter(
      (event) =>
        event.sourceType === "open_answer_review" &&
        concepts.some((item) => item.id === event.conceptId),
    )
    .sort((left, right) => right.occurredAt - left.occurredAt);
  const failedEvents = evidenceData.evidenceEvents
    .filter(
      (event) =>
        event.outcome === "failure" && concepts.some((item) => item.id === event.conceptId),
    )
    .sort((left, right) => right.occurredAt - left.occurredAt)
    .slice(0, 8);
  const repairEvent = repairOfEvidenceId
    ? evidenceData.evidenceEvents.find((event) => event.id === repairOfEvidenceId)
    : undefined;

  useEffect(() => {
    if (!conceptId && concepts[0]) setConceptId(concepts[0].id);
  }, [conceptId, concepts]);

  useEffect(() => {
    setSourceChunkIds(concept?.sourceChunkIds.slice(0, 8) ?? []);
    setReview(null);
    setConfirmed(false);
  }, [conceptId, concept?.sourceChunkIds.join("|")]);

  const resetReviewDecision = () => {
    setReview(null);
    setOutcome("failure");
    setMistakeKind("unclassified");
    setScore(0);
    setReviewSummary("");
    setConfirmed(false);
  };

  const toggleSource = (id: string) => {
    setSourceChunkIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
    resetReviewDecision();
  };

  const runAIReview = async () => {
    if (!concept || prompt.trim().length === 0 || response.trim().length < 8) {
      toast.error(
        isRu
          ? "Выбери понятие, напиши вопрос и содержательный ответ"
          : "Select a concept and provide a prompt and substantive answer",
      );
      return;
    }
    const chunks = conceptChunks.filter((chunk) => sourceChunkIds.includes(chunk.id));
    if (chunks.length === 0) {
      toast.error(isRu ? "Выбери хотя бы один source chunk" : "Select at least one source chunk");
      return;
    }
    setBusy(true);
    setConfirmed(false);
    try {
      const result = await reviewOpenAnswer({
        locale: isRu ? "ru" : "en",
        targetLanguage: isRu ? "ru" : "en",
        course: course
          ? { id: course.id, title: course.title, number: course.number }
          : { id: courseId },
        concept: {
          id: concept.id,
          title: concept.title,
          description: concept.description,
        },
        kind,
        prompt: prompt.trim(),
        response: response.trim(),
        chunks: chunks.map((chunk) => ({
          id: chunk.id,
          title: chunk.title,
          text: chunk.text,
          pageNumber: chunk.pageNumber,
          section: chunk.section,
        })),
        repairContext: repairEvent
          ? {
              evidenceId: repairEvent.id,
              previousPrompt: repairEvent.prompt,
              previousResponse: repairEvent.response,
              previousMistakeKind: repairEvent.mistakeKind,
              previousReviewSummary: repairEvent.reviewSummary,
            }
          : undefined,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setReview(result.data);
      setOutcome(result.data.suggestedOutcome);
      setMistakeKind(
        result.data.suggestedOutcome === "failure"
          ? result.data.suggestedMistakeKind
          : "unclassified",
      );
      setScore(result.data.suggestedScore);
      setReviewSummary(formatOpenAnswerReviewSummary(result.data));
      toast.success(
        isRu
          ? "AI-review готов. Проверь и подтверди решение сам."
          : "AI review is ready. Verify and confirm the decision yourself.",
      );
    } finally {
      setBusy(false);
    }
  };

  const startHumanReview = () => {
    setReview(null);
    setReviewSummary(
      isRu
        ? "Human-only review: пользователь самостоятельно подтвердил результат по выбранным источникам."
        : "Human-only review: the user confirmed the result against the selected sources.",
    );
    setConfirmed(false);
  };

  const saveEvidence = () => {
    if (!concept) return;
    const validation = validateOpenAnswerSaveDraft(
      {
        conceptId: concept.id,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        kind,
        prompt,
        response,
        sourceChunkIds,
        repairOfEvidenceId,
        outcome,
        mistakeKind: outcome === "failure" ? mistakeKind : undefined,
        score,
        reviewSummary,
        reviewMode: review ? "ai_human" : "human",
      },
      concept.sourceChunkIds,
    );
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    if (!confirmed) {
      toast.error(
        isRu
          ? "Сначала подтверди, что ты лично проверил outcome и источники"
          : "Confirm that you personally checked the outcome and sources",
      );
      return;
    }
    const draft = validation.normalized;
    conceptStore.recordEvidence({
      conceptId: draft.conceptId,
      kind: draft.kind,
      outcome: draft.outcome,
      sourceType: "open_answer_review",
      sourceLabel: repairOfEvidenceId
        ? isRu
          ? `Исправление open answer: ${draft.prompt.slice(0, 80)}`
          : `Open-answer repair: ${draft.prompt.slice(0, 80)}`
        : isRu
          ? `Open answer: ${draft.prompt.slice(0, 80)}`
          : `Open answer: ${draft.prompt.slice(0, 80)}`,
      mistakeKind: draft.mistakeKind,
      note: draft.reviewSummary,
      score: draft.score,
      sourceChunkIds: draft.sourceChunkIds,
      prompt: draft.prompt,
      response: draft.response,
      reviewMode: draft.reviewMode,
      reviewSummary: draft.reviewSummary,
      repairOfEvidenceId: draft.repairOfEvidenceId,
    });
    toast.success(
      isRu
        ? draft.repairOfEvidenceId
          ? "Попытка исправления сохранена"
          : "Open-answer evidence сохранён"
        : draft.repairOfEvidenceId
          ? "Repair attempt saved"
          : "Open-answer evidence saved",
    );
    setPrompt("");
    setResponse("");
    setRepairOfEvidenceId(undefined);
    resetReviewDecision();
  };

  const beginRepair = (event: ConceptEvidenceEvent) => {
    setConceptId(event.conceptId);
    setKind(
      event.kind === "application" || event.kind === "explanation" ? event.kind : "explanation",
    );
    setPrompt(
      event.prompt ||
        event.sourceLabel ||
        (isRu ? "Объясни понятие ещё раз" : "Explain the concept again"),
    );
    setResponse("");
    setRepairOfEvidenceId(event.id);
    setSourceChunkIds(
      event.sourceChunkIds && event.sourceChunkIds.length > 0
        ? event.sourceChunkIds
        : (evidenceData.concepts
            .find((item) => item.id === event.conceptId)
            ?.sourceChunkIds.slice(0, 8) ?? []),
    );
    resetReviewDecision();
    toast.info(isRu ? "Открыта новая попытка исправления" : "A new repair attempt is ready");
  };

  if (concepts.length === 0) return null;

  return (
    <section className="mx-auto mt-5 max-w-[1440px] rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary">
            <BrainCircuit className="h-4 w-4" />
            {isRu ? "Открытый ответ и исправление ошибки" : "Open answer and mistake repair"}
          </div>
          <h2 className="mt-2 font-serif text-2xl font-semibold">
            {isRu
              ? "Ответ сохраняется только после твоего решения"
              : "The answer is saved only after your decision"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isRu
              ? "ИИ сравнивает ответ только с выбранными source chunks и предлагает оценку. Ты обязан проверить outcome, тип ошибки и источники. Human-only review остаётся вторичным evidence; AI+human может считаться non-manual."
              : "AI compares the answer only with selected source chunks and proposes a review. You must verify outcome, mistake type and sources. Human-only review remains secondary; AI+human may count as non-manual evidence."}
          </p>
        </div>
        {repairEvent && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-100">
            <div className="flex items-center gap-2 font-medium">
              <RefreshCcw className="h-4 w-4" />
              {isRu ? "Режим исправления" : "Repair mode"}
            </div>
            <p className="mt-1 max-w-sm text-muted-foreground">
              {repairEvent.sourceLabel ?? repairEvent.id}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              {isRu ? "Понятие" : "Concept"}
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={conceptId}
                onChange={(event) => {
                  setConceptId(event.target.value);
                  setRepairOfEvidenceId(undefined);
                  resetReviewDecision();
                }}
              >
                {concepts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              {isRu ? "Тип evidence" : "Evidence kind"}
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as "explanation" | "application");
                  resetReviewDecision();
                }}
              >
                <option value="explanation">{isRu ? "Объяснение" : "Explanation"}</option>
                <option value="application">{isRu ? "Применение" : "Application"}</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block text-xs text-muted-foreground">
            {isRu ? "Вопрос / задача" : "Prompt / task"}
          </label>
          <Input
            className="mt-1"
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              resetReviewDecision();
            }}
            placeholder={
              kind === "application"
                ? isRu
                  ? "Примени понятие к конкретной ситуации"
                  : "Apply the concept to a concrete case"
                : isRu
                  ? "Объясни понятие своими словами"
                  : "Explain the concept in your own words"
            }
          />

          <label className="mt-4 block text-xs text-muted-foreground">
            {isRu ? "Твой ответ" : "Your answer"}
          </label>
          <Textarea
            className="mt-1 min-h-40"
            value={response}
            onChange={(event) => {
              setResponse(event.target.value);
              resetReviewDecision();
            }}
            placeholder={
              isRu
                ? "Напиши полный ответ до проверки"
                : "Write the complete answer before reviewing"
            }
          />

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{isRu ? "Источники для проверки" : "Review sources"}</span>
              <span className="font-mono">{sourceChunkIds.length}</span>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {conceptChunks.map((chunk) => {
                const material = materialById.get(chunk.materialId);
                return (
                  <label
                    key={chunk.id}
                    className="flex cursor-pointer gap-2 rounded-md border border-border p-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={sourceChunkIds.includes(chunk.id)}
                      onChange={() => toggleSource(chunk.id)}
                    />
                    <span className="min-w-0">
                      <strong className="block truncate">
                        {material?.title ?? chunk.title ?? chunk.id}
                      </strong>
                      <span className="mt-1 line-clamp-2 text-muted-foreground">
                        {chunk.pageNumber ? `p.${chunk.pageNumber} · ` : ""}
                        {chunk.text}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => void runAIReview()} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin me-1" />
              ) : (
                <FileSearch className="h-4 w-4 me-1" />
              )}
              {isRu ? "Проверить по источникам" : "Review against sources"}
            </Button>
            <Button variant="outline" onClick={startHumanReview}>
              <ShieldCheck className="h-4 w-4 me-1" />
              {isRu ? "Проверить самостоятельно" : "Review manually"}
            </Button>
          </div>
        </div>

        <aside className="rounded-lg border border-border bg-background p-4">
          <h3 className="font-semibold">
            {isRu ? "Решение перед сохранением" : "Decision before saving"}
          </h3>
          {!review && !reviewSummary ? (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {isRu
                ? "Сначала запусти source-grounded review или выбери самостоятельную проверку. Никакое evidence пока не создано."
                : "Run a source-grounded review or choose manual review first. No evidence has been created."}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {review && (
                <div
                  className={`rounded-md border p-3 text-xs ${review.notFoundInSources ? "border-yellow-500/30 bg-yellow-500/5" : "border-primary/30 bg-primary/5"}`}
                >
                  <strong>
                    {review.notFoundInSources
                      ? isRu
                        ? "Источников недостаточно"
                        : "Sources insufficient"
                      : isRu
                        ? "AI-предложение"
                        : "AI suggestion"}
                  </strong>
                  <p className="mt-1 leading-5 text-muted-foreground">{review.feedback}</p>
                  {review.warnings.map((warning) => (
                    <p key={warning} className="mt-1 text-yellow-200">
                      • {warning}
                    </p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={outcome === "success" ? "default" : "outline"}
                  onClick={() => {
                    setOutcome("success");
                    setConfirmed(false);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 me-1" />
                  {isRu ? "Успех" : "Success"}
                </Button>
                <Button
                  variant={outcome === "failure" ? "destructive" : "outline"}
                  onClick={() => {
                    setOutcome("failure");
                    setConfirmed(false);
                  }}
                >
                  <XCircle className="h-4 w-4 me-1" />
                  {isRu ? "Ошибка" : "Failure"}
                </Button>
              </div>

              <label className="block text-xs text-muted-foreground">
                {isRu ? "Оценка 0–100" : "Score 0–100"}
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(event) => {
                    setScore(Number(event.target.value));
                    setConfirmed(false);
                  }}
                />
              </label>

              {outcome === "failure" && (
                <label className="block text-xs text-muted-foreground">
                  {isRu ? "Тип ошибки — решение человека" : "Mistake type — human decision"}
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={mistakeKind}
                    onChange={(event) => {
                      setMistakeKind(event.target.value as ConceptMistakeKind);
                      setConfirmed(false);
                    }}
                  >
                    {MISTAKE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {mistakeLabel(value, isRu)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block text-xs text-muted-foreground">
                {isRu ? "Итог review" : "Review summary"}
                <Textarea
                  className="mt-1 min-h-28"
                  value={reviewSummary}
                  onChange={(event) => {
                    setReviewSummary(event.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>

              <label className="flex items-start gap-2 rounded-md border border-border p-3 text-xs">
                <input
                  className="mt-0.5"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  {isRu
                    ? "Я лично проверил ответ, outcome, тип ошибки и source chunks. AI — только предложение."
                    : "I personally checked the answer, outcome, mistake type and source chunks. AI is only a suggestion."}
                </span>
              </label>

              <Button className="w-full" onClick={saveEvidence} disabled={!confirmed}>
                {repairOfEvidenceId
                  ? isRu
                    ? "Сохранить попытку исправления"
                    : "Save repair attempt"
                  : isRu
                    ? "Сохранить evidence"
                    : "Save evidence"}
              </Button>
            </div>
          )}
        </aside>
      </div>

      {failedEvents.length > 0 && (
        <div className="mt-5 rounded-lg border border-border bg-background p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-yellow-300" />
            {isRu ? "Ошибки, которые можно исправить" : "Failures available for repair"}
          </h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {failedEvents.map((event) => {
              const eventConcept = concepts.find((item) => item.id === event.conceptId);
              return (
                <div key={event.id} className="rounded-md border border-border p-3 text-xs">
                  <strong className="block truncate">
                    {eventConcept?.title ?? event.conceptId}
                  </strong>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">
                    {event.prompt ?? event.sourceLabel ?? event.note ?? event.id}
                  </p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => beginRepair(event)}
                  >
                    <RefreshCcw className="h-3.5 w-3.5 me-1" />
                    {isRu ? "Исправить" : "Repair"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openAnswerEvents.length > 0 && (
        <div className="mt-5 rounded-lg border border-border bg-background p-4">
          <h3 className="font-semibold">
            {isRu ? "История открытых ответов" : "Open-answer history"}
          </h3>
          <div className="mt-3 space-y-2">
            {openAnswerEvents.slice(0, 12).map((event) => {
              const eventConcept = concepts.find((item) => item.id === event.conceptId);
              return (
                <article key={event.id} className="rounded-md border border-border p-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{eventConcept?.title ?? event.conceptId}</strong>
                        <span
                          className={`rounded-full px-2 py-0.5 ${event.outcome === "success" ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}
                        >
                          {event.outcome}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          {event.reviewMode === "ai_human" ? "AI + human" : "human-only"}
                        </span>
                        {event.repairOfEvidenceId && (
                          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-yellow-200">
                            {isRu ? "исправление" : "repair"}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 font-medium">{event.prompt}</p>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                        {event.response}
                      </p>
                      {event.reviewSummary && (
                        <p className="mt-2 whitespace-pre-wrap rounded bg-muted/30 p-2 text-muted-foreground">
                          {event.reviewSummary}
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => conceptStore.deleteEvidence(event.id)}
                      aria-label={isRu ? "Удалить evidence" : "Delete evidence"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function mistakeLabel(value: ConceptMistakeKind, isRu: boolean): string {
  const labels: Record<ConceptMistakeKind, [string, string]> = {
    retrieval: ["Не вспомнил", "Retrieval failure"],
    confusion: ["Перепутал понятия", "Concept confusion"],
    application: ["Неверно применил", "Application failure"],
    careless: ["Невнимательность", "Careless error"],
    unclassified: ["Не классифицировано", "Unclassified"],
  };
  return labels[value][isRu ? 0 : 1];
}
