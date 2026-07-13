import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Clock3, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AIDraftModal, type AIDraftState } from "@/components/ai-draft-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import {
  checkAIStatus,
  generateStudyPackDraft,
  type AIChunkInput,
  type StudyPackActivity,
  type StudyPackDraft,
} from "@/lib/ai";
import {
  buildStudyPackNoteContent,
  collectStudyPackSourceIds,
  studyPackCopyText,
  validateStudyPackDraft,
} from "@/lib/study-pack";
import { getChunksByMaterial, store, useData } from "@/lib/store";

const MAX_CHUNKS = 8;
const MAX_CHARS = 20_000;

interface StudyPackButtonProps {
  materialId: string;
  courseId?: string;
  topicId?: string;
  initialChunkIds: string[];
  label?: string;
}

export function StudyPackButton(props: StudyPackButtonProps) {
  const { lang } = useApp();
  const [open, setOpen] = useState(false);
  const isRu = lang === "ru";

  return (
    <>
      <Button
        type="button"
        className="w-full justify-start"
        onClick={() => setOpen(true)}
        disabled={props.initialChunkIds.length === 0}
      >
        <BookOpenCheck className="h-4 w-4 me-2" />
        {props.label ?? (isRu ? "Подготовить меня по этой лекции" : "Prepare me from this lecture")}
      </Button>
      <StudyPackDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

function StudyPackDialog(
  props: StudyPackButtonProps & { open: boolean; onOpenChange: (open: boolean) => void },
) {
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const [state, setState] = useState<AIDraftState>("idle");
  const [error, setError] = useState("");
  const [instructions, setInstructions] = useState("");
  const [draft, setDraft] = useState<StudyPackDraft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [saveLocked, setSaveLocked] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  const material = data.materials.find((item) => item.id === props.materialId) ?? null;
  const allChunks = material ? getChunksByMaterial(data, material.id) : [];
  const requestedChunks = allChunks.filter((chunk) => props.initialChunkIds.includes(chunk.id));
  const selectedChunks = requestedChunks.slice(0, MAX_CHUNKS);
  const totalChars = selectedChunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const course = data.courses.find((item) => item.id === (props.courseId ?? material?.courseId));
  const topic = data.topics.find((item) => item.id === (props.topicId ?? material?.topicId));
  const serialized = draft ? JSON.stringify(draft) : "";
  const dirty = state === "ready" && Boolean(baseline) && serialized !== baseline;
  const validationFailures = draft ? validateStudyPackDraft(draft) : ["draft"];
  const saveDisabled = saveLocked || validationFailures.length > 0;

  useEffect(() => {
    if (!props.open) return;
    setState("idle");
    setError("");
    setInstructions("");
    setDraft(null);
    setBaseline("");
    setSaveLocked(false);
    void checkAIStatus().then((status) => setAiConfigured(status.configured));
  }, [props.open]);

  const sources = useMemo(
    () =>
      selectedChunks.map((chunk) => ({
        id: chunk.id,
        title: chunk.title || chunk.section || `${isRu ? "Фрагмент" : "Chunk"} ${chunk.order + 1}`,
      })),
    [selectedChunks, isRu],
  );

  const generate = async () => {
    if (!material || selectedChunks.length === 0) {
      toast.error(isRu ? "Выбери хотя бы один подтверждённый фрагмент" : "Select at least one approved chunk");
      return;
    }
    if (totalChars > MAX_CHARS) {
      toast.error(isRu ? "Выбранные фрагменты слишком длинные" : "The selected chunks are too long");
      return;
    }

    setState("loading");
    setError("");
    const result = await generateStudyPackDraft({
      locale: lang,
      targetLanguage: lang,
      course: course ? { id: course.id, title: course.title, number: course.number } : undefined,
      topic: topic ? { id: topic.id, title: topic.title } : undefined,
      material: { id: material.id, title: material.title, type: material.type },
      chunks: selectedChunks.map<AIChunkInput>((chunk) => ({
        id: chunk.id,
        title: chunk.title,
        text: chunk.text,
        pageNumber: chunk.pageNumber,
        section: chunk.section,
      })),
      instructions: instructions.trim() || undefined,
    });

    if (!result.ok) {
      setError(result.message);
      setState("error");
      return;
    }

    setDraft(result.data);
    setBaseline(JSON.stringify(result.data));
    setSaveLocked(false);
    setState("ready");
  };

  const save = () => {
    if (!material || !draft || state !== "ready" || saveDisabled) return;
    setSaveLocked(true);
    const fallbackSourceIds = selectedChunks.map((chunk) => chunk.id);
    const packSourceIds = collectStudyPackSourceIds(draft);
    const allSourceIds = packSourceIds.length > 0 ? packSourceIds : fallbackSourceIds;
    const context = {
      courseId: props.courseId ?? material.courseId,
      topicId: props.topicId ?? material.topicId,
      materialId: material.id,
    };

    try {
      const note = store.createNote({
        title: draft.title || `${material.title} — Study Pack`,
        content: buildStudyPackNoteContent(draft, lang),
        tags: ["study-pack"],
        ...context,
        sourceChunkIds: allSourceIds,
      });
      store.recordOutput({ materialId: material.id, type: "note", linkedEntityId: note.id });

      for (const card of draft.cards) {
        store.createCard({
          front: card.front,
          back: card.back,
          ...context,
          sourceChunkIds: card.sourceChunkIds.length ? card.sourceChunkIds : fallbackSourceIds,
        });
      }
      if (draft.cards.length > 0) {
        store.recordOutput({ materialId: material.id, type: "flashcards" });
      }

      if (draft.questions.length > 0) {
        const quiz = store.createQuiz({
          title: `${draft.title || material.title} — ${isRu ? "диагностика" : "diagnostic"}`,
          ...context,
        });
        for (const question of draft.questions) {
          store.addQuestion({
            quizId: quiz.id,
            prompt: question.prompt,
            options: question.options,
            correctIndex: question.correctIndex,
            explanation: question.explanation,
            sourceChunkIds: question.sourceChunkIds.length
              ? question.sourceChunkIds
              : fallbackSourceIds,
          });
        }
        store.recordOutput({ materialId: material.id, type: "quiz", linkedEntityId: quiz.id });
      }

      setBaseline(serialized);
      setState("saved");
      toast.success(isRu ? "Учебный комплект сохранён" : "Study pack saved");
    } catch (saveError) {
      setSaveLocked(false);
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setState("error");
    }
  };

  return (
    <AIDraftModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={isRu ? "Учебный комплект" : "Study Pack"}
      state={state}
      error={error}
      warnings={draft?.warnings}
      sourceChunks={sources}
      trust={draft?.trust}
      notFoundInSources={draft?.notFoundInSources}
      onSave={save}
      saveDisabled={saveDisabled}
      onRegenerate={generate}
      copyText={draft ? studyPackCopyText(draft, lang) : undefined}
      dirty={dirty}
    >
      {state === "idle" && (
        <div className="space-y-4">
          <div className="rounded-md border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">
                  {isRu ? "Один источник → готовое занятие" : "One source → a complete study session"}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {isRu
                    ? "Lamdan соберёт ориентацию, маршрут, конспект, термины, карточки, диагностические вопросы и честно отметит пробелы. Ничего не сохранится без твоего подтверждения."
                    : "Lamdan creates an orientation, route, note, terms, cards, diagnostic questions and explicit gaps. Nothing is saved without your confirmation."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ScopeMetric label={isRu ? "Фрагментов" : "Chunks"} value={selectedChunks.length} />
            <ScopeMetric label={isRu ? "Знаков" : "Characters"} value={totalChars.toLocaleString()} />
            <ScopeMetric
              label={isRu ? "Цель" : "Target"}
              value={isRu ? "25–40 мин" : "25–40 min"}
            />
          </div>

          {requestedChunks.length > MAX_CHUNKS && (
            <p className="rounded border border-yellow-500/30 bg-yellow-500/5 p-2 text-xs text-yellow-200">
              {isRu
                ? `Выбрано ${requestedChunks.length} фрагментов. Для надёжной генерации используются первые ${MAX_CHUNKS}.`
                : `${requestedChunks.length} chunks were selected. The first ${MAX_CHUNKS} are used for reliable generation.`}
            </p>
          )}
          {aiConfigured === false && (
            <p className="rounded border border-yellow-500/30 bg-yellow-500/5 p-2 text-xs text-yellow-200">
              {isRu ? "AI-провайдер сейчас не подключён." : "The AI provider is not configured."}
            </p>
          )}

          <div>
            <Label htmlFor="study-pack-instructions">
              {isRu ? "Дополнительные указания" : "Additional instructions"}
            </Label>
            <Textarea
              id="study-pack-instructions"
              className="mt-1 min-h-24"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder={
                isRu
                  ? "Например: объяснения по-русски, термины оставить на иврите, упор на различия похожих понятий."
                  : "For example: keep Hebrew terms, focus on distinctions between similar concepts."
              }
            />
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={generate}
            disabled={selectedChunks.length === 0 || totalChars > MAX_CHARS || aiConfigured === false}
          >
            <Sparkles className="h-4 w-4 me-2" />
            {isRu ? "Собрать учебный комплект" : "Build Study Pack"}
          </Button>
        </div>
      )}

      {state === "ready" && draft && (
        <StudyPackEditor draft={draft} onChange={setDraft} isRu={isRu} failures={validationFailures} />
      )}
    </AIDraftModal>
  );
}

function ScopeMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <strong className="block font-serif text-xl">{value}</strong>
      <span className="mt-1 block text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function StudyPackEditor({
  draft,
  onChange,
  isRu,
  failures,
}: {
  draft: StudyPackDraft;
  onChange: (draft: StudyPackDraft) => void;
  isRu: boolean;
  failures: string[];
}) {
  const update = (patch: Partial<StudyPackDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="space-y-5">
      {failures.length > 0 && (
        <p className="rounded border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-200">
          {isRu
            ? "Перед сохранением заполни пустые поля и проверь, что каждый вопрос имеет четыре уникальных варианта."
            : "Before saving, fill empty fields and make sure every question has four unique options."}
        </p>
      )}

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <div>
          <Label>{isRu ? "Название комплекта" : "Pack title"}</Label>
          <Input
            className="mt-1"
            value={draft.title}
            onChange={(event) => update({ title: event.target.value })}
          />
        </div>
        <div>
          <Label>{isRu ? "Ориентация" : "Orientation"}</Label>
          <Textarea
            className="mt-1 min-h-28"
            dir="auto"
            value={draft.orientation}
            onChange={(event) => update({ orientation: event.target.value })}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          <Input
            type="number"
            min={10}
            max={120}
            className="h-8 w-24"
            value={draft.estimatedMinutes}
            onChange={(event) =>
              update({ estimatedMinutes: Math.max(10, Number(event.target.value) || 10) })
            }
          />
          {isRu ? "минут на весь маршрут" : "minutes for the full route"}
        </div>
      </section>

      <EditableSection title={isRu ? "Маршрут занятия" : "Study route"} count={draft.steps.length}>
        {draft.steps.map((step, index) => (
          <div key={`${step.title}_${index}`} className="rounded-md border border-border bg-background p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_120px_82px_auto]">
              <Input
                value={step.title}
                onChange={(event) =>
                  update({
                    steps: draft.steps.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, title: event.target.value } : item,
                    ),
                  })
                }
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={step.activity}
                onChange={(event) =>
                  update({
                    steps: draft.steps.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, activity: event.target.value as StudyPackActivity }
                        : item,
                    ),
                  })
                }
              >
                {(["orient", "learn", "recall", "practice", "repair"] as const).map((activity) => (
                  <option key={activity} value={activity}>
                    {activity}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                max={45}
                value={step.durationMinutes}
                onChange={(event) =>
                  update({
                    steps: draft.steps.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, durationMinutes: Number(event.target.value) || 1 }
                        : item,
                    ),
                  })
                }
              />
              <RemoveButton
                label={isRu ? "Удалить шаг" : "Remove step"}
                onClick={() => update({ steps: draft.steps.filter((_, itemIndex) => itemIndex !== index) })}
              />
            </div>
            <Textarea
              className="mt-2 min-h-20"
              value={step.purpose}
              onChange={(event) =>
                update({
                  steps: draft.steps.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, purpose: event.target.value } : item,
                  ),
                })
              }
            />
          </div>
        ))}
      </EditableSection>

      <EditableSection title={isRu ? "Чистовой конспект" : "Clean study note"} count={1}>
        <Input
          value={draft.note.title}
          onChange={(event) => update({ note: { ...draft.note, title: event.target.value } })}
        />
        <Textarea
          dir="auto"
          className="mt-2 min-h-64"
          value={draft.note.content}
          onChange={(event) => update({ note: { ...draft.note, content: event.target.value } })}
        />
      </EditableSection>

      <EditableSection title={isRu ? "Ключевые термины" : "Key terms"} count={draft.keyTerms.length}>
        {draft.keyTerms.map((term, index) => (
          <div key={`${term.term}_${index}`} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <Input
              dir="auto"
              value={term.term}
              onChange={(event) =>
                update({
                  keyTerms: draft.keyTerms.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, term: event.target.value } : item,
                  ),
                })
              }
            />
            <Input
              dir="auto"
              value={term.explanation}
              onChange={(event) =>
                update({
                  keyTerms: draft.keyTerms.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, explanation: event.target.value } : item,
                  ),
                })
              }
            />
            <RemoveButton
              label={isRu ? "Удалить термин" : "Remove term"}
              onClick={() =>
                update({ keyTerms: draft.keyTerms.filter((_, itemIndex) => itemIndex !== index) })
              }
            />
          </div>
        ))}
      </EditableSection>

      <EditableSection title={isRu ? "Карточки" : "Flashcards"} count={draft.cards.length}>
        {draft.cards.map((card, index) => (
          <div key={`${card.front}_${index}`} className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-2">
            <Textarea
              dir="auto"
              className="min-h-24"
              value={card.front}
              onChange={(event) =>
                update({
                  cards: draft.cards.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, front: event.target.value } : item,
                  ),
                })
              }
            />
            <div className="flex gap-2">
              <Textarea
                dir="auto"
                className="min-h-24 flex-1"
                value={card.back}
                onChange={(event) =>
                  update({
                    cards: draft.cards.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, back: event.target.value } : item,
                    ),
                  })
                }
              />
              <RemoveButton
                label={isRu ? "Удалить карточку" : "Remove card"}
                onClick={() => update({ cards: draft.cards.filter((_, itemIndex) => itemIndex !== index) })}
              />
            </div>
          </div>
        ))}
      </EditableSection>

      <EditableSection
        title={isRu ? "Диагностические вопросы" : "Diagnostic questions"}
        count={draft.questions.length}
      >
        {draft.questions.map((question, index) => (
          <div key={`${question.prompt}_${index}`} className="rounded-md border border-border bg-background p-3">
            <div className="flex gap-2">
              <Textarea
                dir="auto"
                className="min-h-20 flex-1"
                value={question.prompt}
                onChange={(event) =>
                  update({
                    questions: draft.questions.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, prompt: event.target.value } : item,
                    ),
                  })
                }
              />
              <RemoveButton
                label={isRu ? "Удалить вопрос" : "Remove question"}
                onClick={() =>
                  update({ questions: draft.questions.filter((_, itemIndex) => itemIndex !== index) })
                }
              />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`study-pack-question-${index}`}
                    checked={question.correctIndex === optionIndex}
                    onChange={() =>
                      update({
                        questions: draft.questions.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, correctIndex: optionIndex } : item,
                        ),
                      })
                    }
                  />
                  <Input
                    dir="auto"
                    value={option}
                    onChange={(event) =>
                      update({
                        questions: draft.questions.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                options: item.options.map((current, currentIndex) =>
                                  currentIndex === optionIndex ? event.target.value : current,
                                ),
                              }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <Textarea
              dir="auto"
              className="mt-2 min-h-20"
              value={question.explanation}
              onChange={(event) =>
                update({
                  questions: draft.questions.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, explanation: event.target.value } : item,
                  ),
                })
              }
              placeholder={isRu ? "Объяснение ответа" : "Answer explanation"}
            />
          </div>
        ))}
      </EditableSection>

      {draft.unclearAreas.length > 0 && (
        <EditableSection
          title={isRu ? "Что требует проверки" : "What needs review"}
          count={draft.unclearAreas.length}
        >
          {draft.unclearAreas.map((area, index) => (
            <div key={`${area.description}_${index}`} className="flex gap-2">
              <Textarea
                dir="auto"
                className="min-h-20 flex-1"
                value={area.description}
                onChange={(event) =>
                  update({
                    unclearAreas: draft.unclearAreas.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, description: event.target.value } : item,
                    ),
                  })
                }
              />
              <RemoveButton
                label={isRu ? "Удалить пункт" : "Remove item"}
                onClick={() =>
                  update({
                    unclearAreas: draft.unclearAreas.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              />
            </div>
          ))}
        </EditableSection>
      )}
    </div>
  );
}

function EditableSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="rounded border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" size="icon" variant="ghost" aria-label={label} title={label} onClick={onClick}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
