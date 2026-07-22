import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { conceptStore, useConceptEvidenceData } from "@/lib/concept-store";
import { useData } from "@/lib/store";
import {
  buildTopicRecallAttemptKey,
  evaluateTopicRecall,
  type TopicRecallResult,
} from "@/lib/topic-learning-slice";

const RECALL_SOURCE = "Deterministic topic recall";

export function TopicLearningSlice({ courseId }: { courseId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const core = useData();
  const evidence = useConceptEvidenceData();
  const topics = core.topics.filter((topic) => topic.courseId === courseId);
  const concepts = evidence.concepts.filter(
    (concept) => concept.courseId === courseId && concept.topicId && concept.description?.trim(),
  );
  const availableTopicIds = new Set(concepts.map((concept) => concept.topicId));
  const availableTopics = topics.filter((topic) => availableTopicIds.has(topic.id));
  const [topicId, setTopicId] = useState(availableTopics[0]?.id ?? "");
  const [response, setResponse] = useState("");
  const [result, setResult] = useState<TopicRecallResult | null>(null);

  const concept = useMemo(
    () => concepts.find((item) => item.topicId === topicId) ?? concepts[0],
    [concepts, topicId],
  );

  if (!concept || availableTopics.length === 0) {
    return (
      <section className="mx-auto mt-5 max-w-[1440px] rounded-xl border border-dashed border-border bg-surface p-5">
        <strong>{isRu ? "Explain → recall → verify пока недоступен" : "Explain → recall → verify is not ready"}</strong>
        <p className="mt-2 text-sm text-muted-foreground">
          {isRu
            ? "Для темы нужно хотя бы одно понятие с кратким описанием. Добавь или извлеки понятие в лаборатории знаний."
            : "The topic needs at least one concept with a short explanation. Add or extract one in the knowledge lab."}
        </p>
      </section>
    );
  }

  const selectedTopicId = concept.topicId ?? "";
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
  const latestVerified = evidence.evidenceEvents
    .filter(
      (event) =>
        event.conceptId === concept.id &&
        event.kind === "recall" &&
        event.sourceLabel === RECALL_SOURCE,
    )
    .slice()
    .sort((left, right) => right.occurredAt - left.occurredAt)[0];

  const verify = () => {
    const trimmedResponse = response.trim();
    const evaluation = evaluateTopicRecall({
      title: concept.title,
      aliases: concept.aliases,
      explanation: concept.description ?? "",
      response: trimmedResponse,
    });
    setResult(evaluation);

    const sourceId = buildTopicRecallAttemptKey(concept.id, trimmedResponse);
    const alreadyRecorded = evidence.evidenceEvents.some(
      (event) =>
        event.conceptId === concept.id &&
        event.kind === "recall" &&
        event.sourceLabel === RECALL_SOURCE &&
        event.sourceId === sourceId,
    );
    if (alreadyRecorded) return;

    conceptStore.recordEvidence({
      conceptId: concept.id,
      kind: "recall",
      outcome: evaluation.passed ? "success" : "failure",
      sourceType: "deterministic_recall",
      sourceId,
      sourceLabel: RECALL_SOURCE,
      mistakeKind: evaluation.passed ? undefined : "retrieval",
      note: evaluation.explanation,
      score: evaluation.score,
      prompt: isRu ? `Объясни своими словами: ${concept.title}` : `Explain in your own words: ${concept.title}`,
      response: trimmedResponse,
    });
  };

  const reset = () => {
    setResponse("");
    setResult(null);
  };

  return (
    <section className="mx-auto mt-5 max-w-[1440px] rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-primary">understand → recall → verify</div>
          <h2 className="mt-2 font-serif text-2xl font-semibold">
            {isRu ? "Короткая проверка темы" : "Topic learning check"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRu
              ? "Прогресс обновляется только после детерминированной проверки ответа."
              : "Progress updates only after deterministic answer verification."}
          </p>
          {latestVerified && (
            <div
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs"
              data-persisted-topic-progress={latestVerified.outcome}
            >
              {latestVerified.outcome === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              )}
              {latestVerified.outcome === "success"
                ? isRu
                  ? "Подтверждённый прогресс"
                  : "Verified progress"
                : isRu
                  ? "Последняя проверка не пройдена"
                  : "Last check failed"}
              {latestVerified.score != null ? ` · ${latestVerified.score}%` : ""}
            </div>
          )}
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedTopicId}
          onChange={(event) => {
            setTopicId(event.target.value);
            reset();
          }}
        >
          {availableTopics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.title}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-border bg-background p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Explain</div>
          <h3 className="mt-2 font-serif text-xl font-semibold">{selectedTopic?.title ?? concept.title}</h3>
          <strong className="mt-4 block text-sm">{concept.title}</strong>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {concept.description}
          </p>
        </article>

        <article className="rounded-lg border border-border bg-background p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recall</div>
          <label className="mt-2 block text-sm font-medium">
            {isRu ? `Объясни своими словами: ${concept.title}` : `Explain in your own words: ${concept.title}`}
          </label>
          <Textarea
            className="mt-3 min-h-32"
            value={response}
            onChange={(event) => {
              setResponse(event.target.value);
              setResult(null);
            }}
            placeholder={isRu ? "Напиши ответ без подсказки…" : "Answer without looking back…"}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={verify} disabled={response.trim().length < 3}>
              {isRu ? "Проверить ответ" : "Verify answer"}
            </Button>
            <Button variant="outline" onClick={reset} disabled={!response && !result}>
              <RotateCcw className="me-1 h-4 w-4" />
              {isRu ? "Сбросить" : "Reset"}
            </Button>
          </div>

          {result && (
            <div
              className={`mt-4 rounded-md border p-3 text-sm ${
                result.passed ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"
              }`}
              data-topic-recall-result={result.passed ? "passed" : "failed"}
            >
              <div className="flex items-center gap-2 font-semibold">
                {result.passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {result.passed ? (isRu ? "Подтверждено" : "Verified") : isRu ? "Нужно повторить" : "Needs review"}
                <span className="ms-auto">{result.score}%</span>
              </div>
              <p className="mt-2 text-xs leading-5">{result.explanation}</p>
              <p className="mt-2 text-xs font-medium" data-topic-recall-match-breakdown>
                {isRu
                  ? `Совпало точно: ${result.exactMatches.length} · По словоформе: ${result.normalizedMatches.length}`
                  : `Exact matches: ${result.exactMatches.length} · Normalized forms: ${result.normalizedMatches.length}`}
              </p>
              {result.missingTerms.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {isRu ? "Не отражены идеи" : "Missing ideas"}: {result.missingTerms.join(", ")}
                </p>
              )}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
