import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpenCheck,
  BrainCircuit,
  Download,
  FileUp,
  Layers3,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import {
  summarizeConceptEvidence,
  type Concept,
  type ConceptEvidenceEvent,
  type ConceptKnowledgeState,
  type ConceptMistakeKind,
} from "@/lib/concept-evidence";
import {
  conceptStore,
  exportConceptEvidenceJSON,
  importConceptEvidenceJSON,
  recordManualConceptEvidence,
  useConceptEvidenceData,
} from "@/lib/concept-store";
import { useData } from "@/lib/store";

export function ConceptEvidenceWorkspace({ courseId }: { courseId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const core = useData();
  const conceptData = useConceptEvidenceData();
  const importRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState("_none");

  const course = core.courses.find((item) => item.id === courseId);
  const topics = core.topics.filter((item) => item.courseId === courseId);
  const materials = core.materials.filter((item) => item.courseId === courseId);
  const materialIds = new Set(materials.map((item) => item.id));
  const chunks = core.materialChunks.filter((item) => materialIds.has(item.materialId));
  const cards = core.flashcards.filter((item) => item.courseId === courseId);
  const quizzes = core.quizzes.filter((item) => item.courseId === courseId);
  const quizIds = new Set(quizzes.map((item) => item.id));
  const questions = core.quizQuestions.filter((item) => quizIds.has(item.quizId));
  const concepts = conceptData.concepts
    .filter((item) => item.courseId === courseId)
    .slice()
    .sort((left, right) => left.title.localeCompare(right.title));

  const createConcept = () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    conceptStore.createConcept({
      courseId,
      topicId: topicId === "_none" ? undefined : topicId,
      title: nextTitle,
    });
    setTitle("");
    toast.success(isRu ? "Понятие добавлено" : "Concept added");
  };

  const exportCourse = () => {
    const blob = new Blob([exportConceptEvidenceJSON(courseId)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lamdan-concepts-${safeName(course?.title ?? courseId)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    const result = importConceptEvidenceJSON(await file.text(), "merge");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      isRu
        ? `Импортировано понятий: ${result.importedConcepts}, событий: ${result.importedEvents}`
        : `Imported ${result.importedConcepts} concepts and ${result.importedEvents} events`,
    );
  };

  return (
    <section className="mx-auto mt-5 max-w-[1440px] rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary">
            <BrainCircuit className="h-4 w-4" />
            {isRu ? "Карта знаний" : "Knowledge evidence map"}
          </div>
          <h2 className="mt-2 font-serif text-2xl font-semibold">
            {isRu ? "Понятия и реальные доказательства" : "Concepts and real learning evidence"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isRu
              ? "Файлы, конспекты и время не повышают состояние знания. Lamdan учитывает только связанные карточки, тестовые попытки как нейтральный контекст и явные проверки объяснения или применения."
              : "Files, notes and time do not raise knowledge state. Lamdan uses linked card outcomes, quiz attempts as neutral context, and explicit explanation or application checks."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importFile(file);
            }}
          />
          <Button variant="outline" onClick={() => importRef.current?.click()}>
            <FileUp className="h-4 w-4 me-1" />
            {isRu ? "Импорт" : "Import"}
          </Button>
          <Button variant="outline" onClick={exportCourse} disabled={concepts.length === 0}>
            <Download className="h-4 w-4 me-1" />
            {isRu ? "Экспорт" : "Export"}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_240px_auto]">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && createConcept()}
          placeholder={isRu ? "Например: разделение властей" : "For example: separation of powers"}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={topicId}
          onChange={(event) => setTopicId(event.target.value)}
        >
          <option value="_none">{isRu ? "Без темы" : "No topic"}</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.title}
            </option>
          ))}
        </select>
        <Button onClick={createConcept} disabled={!title.trim()}>
          <Plus className="h-4 w-4 me-1" />
          {isRu ? "Добавить" : "Add"}
        </Button>
      </div>

      {concepts.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center">
          <BrainCircuit className="mx-auto h-9 w-9 text-muted-foreground" />
          <strong className="mt-3 block">{isRu ? "Понятий пока нет" : "No concepts yet"}</strong>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            {isRu
              ? "Добавь понятие и вручную свяжи его с подтверждёнными фрагментами, карточками и вопросами. Никаких автоматических выводов о знании не будет."
              : "Add a concept and explicitly link it to approved chunks, cards and questions. No knowledge claims are created automatically."}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {concepts.map((concept) => (
            <ConceptPanel
              key={concept.id}
              concept={concept}
              events={conceptData.evidenceEvents.filter((event) => event.conceptId === concept.id)}
              topics={topics}
              chunks={chunks}
              materials={materials}
              cards={cards}
              questions={questions}
              quizzes={quizzes}
              isRu={isRu}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ConceptPanel({
  concept,
  events,
  topics,
  chunks,
  materials,
  cards,
  questions,
  quizzes,
  isRu,
}: {
  concept: Concept;
  events: ConceptEvidenceEvent[];
  topics: ReturnType<typeof useData>["topics"];
  chunks: ReturnType<typeof useData>["materialChunks"];
  materials: ReturnType<typeof useData>["materials"];
  cards: ReturnType<typeof useData>["flashcards"];
  questions: ReturnType<typeof useData>["quizQuestions"];
  quizzes: ReturnType<typeof useData>["quizzes"];
  isRu: boolean;
}) {
  const summary = useMemo(
    () => summarizeConceptEvidence(concept, events),
    [concept, events],
  );
  const materialById = new Map(materials.map((item) => [item.id, item]));
  const quizById = new Map(quizzes.map((item) => [item.id, item]));
  const firstQuestion = questions.find((item) => concept.quizQuestionIds.includes(item.id));
  const firstChunk = chunks.find((item) => concept.sourceChunkIds.includes(item.id));
  const repairTarget = firstQuestion
    ? {
        to: "/app/quizzes/$quizId",
        params: { quizId: firstQuestion.quizId },
        label: isRu ? "Проверить тестом" : "Practice with quiz",
      }
    : concept.flashcardIds.length > 0
      ? { to: "/app/flashcards", params: undefined, label: isRu ? "Повторить карточки" : "Review cards" }
      : firstChunk
        ? {
            to: "/app/materials/$materialId",
            params: { materialId: firstChunk.materialId },
            label: isRu ? "Открыть источник" : "Open source",
          }
        : null;

  const toggle = (
    field: "sourceChunkIds" | "flashcardIds" | "quizQuestionIds",
    id: string,
  ) => {
    const values = concept[field];
    conceptStore.updateConcept(concept.id, {
      [field]: values.includes(id) ? values.filter((value) => value !== id) : [...values, id],
    });
  };

  return (
    <details className="group rounded-lg border border-border bg-background">
      <summary className="cursor-pointer list-none p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge state={summary.state} isRu={isRu} />
              <strong className="font-serif text-lg">{concept.title}</strong>
              {concept.topicId && (
                <span className="text-xs text-muted-foreground">
                  {topics.find((item) => item.id === concept.topicId)?.title}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {localizedReason(summary.state, isRu)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs md:min-w-72">
            <Metric label={isRu ? "Источники" : "Sources"} value={summary.sourceCoverageCount} />
            <Metric label={isRu ? "Успехи" : "Successes"} value={summary.successCount} />
            <Metric label={isRu ? "Ошибки" : "Failures"} value={summary.failureCount} />
          </div>
        </div>
      </summary>

      <div className="border-t border-border p-4 md:p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">{isRu ? "Название" : "Title"}</label>
                <Input
                  className="mt-1"
                  value={concept.title}
                  onChange={(event) => conceptStore.updateConcept(concept.id, { title: event.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{isRu ? "Тема" : "Topic"}</label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={concept.topicId ?? "_none"}
                  onChange={(event) =>
                    conceptStore.updateConcept(concept.id, {
                      topicId: event.target.value === "_none" ? undefined : event.target.value,
                    })
                  }
                >
                  <option value="_none">{isRu ? "Без темы" : "No topic"}</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">{isRu ? "Описание" : "Description"}</label>
                <Textarea
                  className="mt-1 min-h-20"
                  value={concept.description ?? ""}
                  onChange={(event) =>
                    conceptStore.updateConcept(concept.id, { description: event.target.value || undefined })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">
                  {isRu ? "Синонимы через запятую" : "Aliases separated by commas"}
                </label>
                <Input
                  className="mt-1"
                  value={concept.aliases.join(", ")}
                  onChange={(event) =>
                    conceptStore.updateConcept(concept.id, {
                      aliases: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            </section>

            <LinkSection
              title={isRu ? "Подтверждённые фрагменты" : "Approved source chunks"}
              empty={isRu ? "В курсе нет фрагментов." : "The course has no chunks."}
            >
              {chunks.map((chunk) => (
                <CheckRow
                  key={chunk.id}
                  checked={concept.sourceChunkIds.includes(chunk.id)}
                  onChange={() => toggle("sourceChunkIds", chunk.id)}
                  title={chunk.title || chunk.section || `${isRu ? "Фрагмент" : "Chunk"} ${chunk.order + 1}`}
                  meta={materialById.get(chunk.materialId)?.title ?? chunk.materialId}
                />
              ))}
            </LinkSection>

            <LinkSection title={isRu ? "Карточки для recall" : "Flashcards for recall"} empty={isRu ? "Карточек нет." : "No cards."}>
              {cards.map((card) => (
                <CheckRow
                  key={card.id}
                  checked={concept.flashcardIds.includes(card.id)}
                  onChange={() => toggle("flashcardIds", card.id)}
                  title={card.front}
                  meta={card.back}
                />
              ))}
            </LinkSection>

            <LinkSection title={isRu ? "Вопросы тестов" : "Quiz questions"} empty={isRu ? "Вопросов нет." : "No questions."}>
              {questions.map((question) => (
                <CheckRow
                  key={question.id}
                  checked={concept.quizQuestionIds.includes(question.id)}
                  onChange={() => toggle("quizQuestionIds", question.id)}
                  title={question.prompt}
                  meta={quizById.get(question.quizId)?.title ?? question.quizId}
                />
              ))}
            </LinkSection>
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-border bg-surface p-4">
              <h3 className="font-semibold">{isRu ? "Следующее доказательство" : "Next evidence"}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isRu
                  ? "Нейтральная попытка теста видна в журнале, но не повышает состояние отдельного понятия без ответов по вопросам."
                  : "A quiz attempt is visible as neutral context but cannot raise one concept without per-question evidence."}
              </p>
              <div className="mt-3 grid gap-2">
                {repairTarget && (
                  <Link
                    to={repairTarget.to as never}
                    params={repairTarget.params as never}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm hover:bg-accent"
                  >
                    <BookOpenCheck className="h-4 w-4 me-1" />
                    {repairTarget.label}
                  </Link>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    recordManualConceptEvidence({ conceptId: concept.id, kind: "explanation", outcome: "success" })
                  }
                >
                  {isRu ? "Смог объяснить без подсказки" : "Explained without help"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    recordManualConceptEvidence({ conceptId: concept.id, kind: "explanation", outcome: "failure" })
                  }
                >
                  {isRu ? "Не смог объяснить" : "Could not explain"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    recordManualConceptEvidence({ conceptId: concept.id, kind: "application", outcome: "success" })
                  }
                >
                  {isRu ? "Применил в новой задаче" : "Applied in a new task"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    recordManualConceptEvidence({ conceptId: concept.id, kind: "application", outcome: "failure" })
                  }
                >
                  {isRu ? "Ошибка в применении" : "Application failed"}
                </Button>
              </div>
            </section>

            <EvidenceHistory concept={concept} events={events} isRu={isRu} />

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                const confirmed = confirm(
                  isRu
                    ? "Удалить понятие и весь его журнал доказательств?"
                    : "Delete the concept and all of its evidence history?",
                );
                if (confirmed) conceptStore.deleteConcept(concept.id);
              }}
            >
              <Trash2 className="h-4 w-4 me-1" />
              {isRu ? "Удалить понятие" : "Delete concept"}
            </Button>
          </aside>
        </div>
      </div>
    </details>
  );
}

function EvidenceHistory({ concept, events, isRu }: { concept: Concept; events: ConceptEvidenceEvent[]; isRu: boolean }) {
  const sorted = events.slice().sort((left, right) => right.occurredAt - left.occurredAt);
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{isRu ? "Журнал доказательств" : "Evidence history"}</h3>
        <span className="text-xs text-muted-foreground">{sorted.length}</span>
      </div>
      {sorted.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {isRu ? "Пока нет ни одного события." : "No evidence events yet."}
        </p>
      ) : (
        <div className="mt-3 max-h-[440px] space-y-2 overflow-auto">
          {sorted.map((event) => (
            <div key={event.id} className="rounded-md border border-border bg-background p-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{eventKind(event, isRu)}</span>
                    <OutcomeBadge event={event} isRu={isRu} />
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {event.sourceLabel ?? event.sourceType}
                    {event.score != null ? ` · ${event.score}%` : ""}
                    {event.note ? ` · ${event.note}` : ""}
                  </div>
                  <time className="mt-1 block text-[10px] text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleString(isRu ? "ru-RU" : "en-GB")}
                  </time>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={isRu ? "Удалить событие" : "Remove event"}
                  onClick={() => conceptStore.deleteEvidence(event.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {event.outcome === "failure" && (
                <select
                  className="mt-2 h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  value={event.mistakeKind ?? "unclassified"}
                  onChange={(change) =>
                    conceptStore.updateEvidence(event.id, {
                      mistakeKind: change.target.value as ConceptMistakeKind,
                    })
                  }
                >
                  <option value="unclassified">{isRu ? "Причина не классифицирована" : "Unclassified"}</option>
                  <option value="retrieval">{isRu ? "Не вспомнил" : "Retrieval failure"}</option>
                  <option value="confusion">{isRu ? "Перепутал понятия" : "Concept confusion"}</option>
                  <option value="application">{isRu ? "Не смог применить" : "Application failure"}</option>
                  <option value="careless">{isRu ? "Невнимательность" : "Careless error"}</option>
                </select>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 border-t border-border pt-3 text-[10px] leading-4 text-muted-foreground">
        {isRu
          ? `Все события для «${concept.title}» можно проверить и удалить. Удаление пересчитывает состояние сразу.`
          : `Every event for “${concept.title}” is inspectable and removable. Deletion recalculates the state immediately.`}
      </p>
    </section>
  );
}

function LinkSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="mt-2 max-h-64 space-y-1 overflow-auto rounded-md border border-border bg-surface p-2">
        {items.length === 0 ? <p className="p-2 text-xs text-muted-foreground">{empty}</p> : children}
      </div>
    </section>
  );
}

function CheckRow({ checked, onChange, title, meta }: { checked: boolean; onChange: () => void; title: string; meta?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-accent">
      <input type="checkbox" className="mt-1" checked={checked} onChange={onChange} />
      <span className="min-w-0">
        <strong className="block truncate text-xs">{title}</strong>
        {meta && <span className="mt-0.5 block line-clamp-1 text-[10px] text-muted-foreground">{meta}</span>}
      </span>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded border border-border bg-surface px-2 py-2">
      <strong className="block font-mono text-sm">{value}</strong>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </span>
  );
}

function StateBadge({ state, isRu }: { state: ConceptKnowledgeState; isRu: boolean }) {
  const classes: Record<ConceptKnowledgeState, string> = {
    unseen: "border-border bg-surface text-muted-foreground",
    covered: "border-border bg-surface text-foreground",
    fragile: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
    weak: "border-red-500/30 bg-red-500/10 text-red-200",
    strong: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  };
  const labels: Record<ConceptKnowledgeState, [string, string]> = {
    unseen: ["Не встречалось", "Unseen"],
    covered: ["Есть материал", "Covered"],
    fragile: ["Хрупкое знание", "Fragile"],
    weak: ["Повторные ошибки", "Weak"],
    strong: ["Сильные доказательства", "Strong evidence"],
  };
  return (
    <span className={`rounded border px-2 py-1 text-[10px] ${classes[state]}`}>
      {labels[state][isRu ? 0 : 1]}
    </span>
  );
}

function OutcomeBadge({ event, isRu }: { event: ConceptEvidenceEvent; isRu: boolean }) {
  if (event.outcome === "mixed") {
    return (
      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
        {isRu ? "Контекст, не оценка" : "Context only"}
      </span>
    );
  }
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] ${
        event.outcome === "success" ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"
      }`}
    >
      {event.outcome === "success" ? (isRu ? "Успех" : "Success") : isRu ? "Ошибка" : "Failure"}
    </span>
  );
}

function eventKind(event: ConceptEvidenceEvent, isRu: boolean): string {
  const labels: Record<ConceptEvidenceEvent["kind"], [string, string]> = {
    recognition: ["Распознавание", "Recognition"],
    recall: ["Воспроизведение", "Recall"],
    explanation: ["Объяснение", "Explanation"],
    application: ["Применение", "Application"],
    assessment: ["Попытка теста", "Quiz attempt"],
  };
  return labels[event.kind][isRu ? 0 : 1];
}

function localizedReason(state: ConceptKnowledgeState, isRu: boolean): string {
  const reasons: Record<ConceptKnowledgeState, [string, string]> = {
    unseen: ["Нет связанных источников и учебных доказательств.", "No linked sources or learning evidence."],
    covered: ["Есть источник или практика, но ещё нет оцениваемого результата.", "Source or practice exists, but no scored evidence yet."],
    fragile: ["Есть отдельные результаты, но их мало, они однотипны или устарели.", "Evidence exists but is limited, one-dimensional, or old."],
    weak: ["Повторные ошибки или последняя ошибка перевешивают успехи.", "Repeated failures or a recent failure dominate."],
    strong: ["Минимум четыре успеха, два дня и два типа доказательств без доминирующей свежей ошибки.", "At least four successes across two days and two evidence types without a dominant recent failure."],
  };
  return reasons[state][isRu ? 0 : 1];
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9а-яё_-]+/gi, "-").replace(/^-+|-+$/g, "") || "course";
}
