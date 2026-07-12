import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AIDraftModal, type AIDraftSource, type AIDraftState } from "@/components/ai-draft-modal";
import {
  FlashcardsDraftEditor,
  NoteDraftEditor,
  PresentationDraftEditor,
  QuizDraftEditor,
} from "@/components/ai-draft-editors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import {
  checkAIStatus,
  generateFlashcardsDraft,
  generateNoteDraft,
  generatePresentationOutlineDraft,
  generateQuizDraft,
  type AIChunkInput,
  type FlashcardsDraft,
  type NoteDraft,
  type PresentationDraft,
  type QuizDraft,
} from "@/lib/ai";
import { getChunksByMaterial, store, useData, type MaterialChunk } from "@/lib/store";

export type AIGenerateKind = "note" | "flashcards" | "quiz" | "presentation";
type DraftValue = NoteDraft | FlashcardsDraft | QuizDraft | PresentationDraft;

interface AIGenerateDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  kind: AIGenerateKind;
  initialMaterialId?: string;
  initialCourseId?: string;
  initialTopicId?: string;
  initialChunkIds?: string[];
}

const MAX_CHUNKS = 8;
const MAX_CHARS = 20_000;

export function AIGenerateDialog(props: AIGenerateDialogProps) {
  const { t, lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const [materialId, setMaterialId] = useState(props.initialMaterialId ?? "");
  const [selected, setSelected] = useState<string[]>(props.initialChunkIds ?? []);
  const [instructions, setInstructions] = useState("");
  const [state, setState] = useState<AIDraftState>("idle");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [note, setNote] = useState<NoteDraft | null>(null);
  const [cards, setCards] = useState<FlashcardsDraft | null>(null);
  const [quiz, setQuiz] = useState<QuizDraft | null>(null);
  const [presentation, setPresentation] = useState<PresentationDraft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [saveLocked, setSaveLocked] = useState(false);
  const [regeneratingItem, setRegeneratingItem] = useState<number | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (props.open) void checkAIStatus().then((status) => setAiConfigured(status.configured));
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    setMaterialId(props.initialMaterialId ?? "");
    setSelected(props.initialChunkIds ?? []);
    setInstructions("");
    setState("idle");
    setError("");
    setWarnings([]);
    setNote(null);
    setCards(null);
    setQuiz(null);
    setPresentation(null);
    setBaseline("");
    setSaveLocked(false);
    setRegeneratingItem(null);
  }, [props.open, props.initialMaterialId, props.initialChunkIds]);

  const material = data.materials.find((item) => item.id === materialId) ?? null;
  const chunks: MaterialChunk[] = material ? getChunksByMaterial(data, material.id) : [];
  const selectedChunks = chunks.filter((c) => selected.includes(c.id));
  const totalChars = selectedChunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const overLimit = totalChars > 20_000;
  const courseId = props.initialCourseId ?? material?.courseId;
  const topicId = props.initialTopicId ?? material?.topicId;
  const course = data.courses.find((item) => item.id === courseId);
  const topic = data.topics.find((item) => item.id === topicId);

  const currentDraft = useMemo<DraftValue | null>(() => {
    if (props.kind === "note") return note;
    if (props.kind === "flashcards") return cards;
    if (props.kind === "quiz") return quiz;
    return presentation;
  }, [props.kind, note, cards, quiz, presentation]);
  const serializedDraft = currentDraft ? JSON.stringify(currentDraft) : "";
  const dirty = state === "ready" && Boolean(baseline) && serializedDraft !== baseline;
  const draftValid = validateDraft(props.kind, currentDraft);

  const toggleChunk = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_CHUNKS) return current;
      return [...current, id];
    });
  };

  const buildInput = (options?: { chunks?: MaterialChunk[]; instructions?: string }) => ({
    locale: lang,
    targetLanguage: lang,
    course: course ? { id: course.id, title: course.title, number: course.number } : undefined,
    topic: topic ? { id: topic.id, title: topic.title } : undefined,
    material: material
      ? { id: material.id, title: material.title, type: material.type }
      : undefined,
    chunks: (options?.chunks ?? selectedChunks).map<AIChunkInput>((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
      section: chunk.section,
    })),
    instructions: options?.instructions ?? (instructions.trim() || undefined),
  });

  const applyDraft = (kind: AIGenerateKind, draft: DraftValue) => {
    setNote(kind === "note" ? (draft as NoteDraft) : null);
    setCards(kind === "flashcards" ? (draft as FlashcardsDraft) : null);
    setQuiz(kind === "quiz" ? (draft as QuizDraft) : null);
    setPresentation(kind === "presentation" ? (draft as PresentationDraft) : null);
    setWarnings(draft.warnings ?? []);
    setBaseline(JSON.stringify(draft));
    setSaveLocked(false);
    setState("ready");
  };

  const failGeneration = (message: string) => {
    setError(message);
    setState("error");
  };

  const generate = async () => {
    if (selected.length === 0 || selectedChunks.length === 0) {
      toast.error(t.aiNoChunksSelected);
      return;
    }
    if (overLimit) {
      toast.error(t.aiTooManyChars);
      return;
    }
    setState("loading");
    setError("");
    setWarnings([]);
    const input = buildInput();

    if (props.kind === "note") {
      const result = await generateNoteDraft(input);
      if (result.ok) applyDraft("note", result.data);
      else failGeneration(result.message);
      return;
    }
    if (props.kind === "flashcards") {
      const result = await generateFlashcardsDraft(input);
      if (result.ok) applyDraft("flashcards", result.data);
      else failGeneration(result.message);
      return;
    }
    if (props.kind === "quiz") {
      const result = await generateQuizDraft(input);
      if (result.ok) applyDraft("quiz", result.data);
      else failGeneration(result.message);
      return;
    }
    const result = await generatePresentationOutlineDraft(input);
    if (result.ok) applyDraft("presentation", result.data);
    else failGeneration(result.message);
  };

  const sourceScope = (sourceIds: string[] | undefined) => {
    const scoped = selectedChunks.filter((chunk) => sourceIds?.includes(chunk.id));
    return scoped.length > 0 ? scoped : selectedChunks;
  };

  const regenerateCard = async (index: number) => {
    if (!cards || regeneratingItem !== null) return;
    const original = cards.cards[index];
    setRegeneratingItem(index);
    const result = await generateFlashcardsDraft(
      buildInput({
        chunks: sourceScope(original.sourceChunkIds),
        instructions: isRu
          ? "Создай ровно одну улучшенную карточку на замену. Она должна быть атомарной и опираться только на источники."
          : "Generate exactly one improved replacement flashcard grounded only in the sources.",
      }),
    );
    setRegeneratingItem(null);
    if (!result.ok || result.data.cards.length === 0) {
      toast.error(result.ok ? t.aiError : result.message);
      return;
    }
    const replacement = result.data.cards[0];
    setCards({
      ...cards,
      cards: cards.cards.map((card, cardIndex) =>
        cardIndex === index
          ? {
              ...replacement,
              sourceChunkIds: replacement.sourceChunkIds?.length
                ? replacement.sourceChunkIds
                : original.sourceChunkIds,
            }
          : card,
      ),
    });
  };

  const regenerateQuestion = async (index: number) => {
    if (!quiz || regeneratingItem !== null) return;
    const original = quiz.questions[index];
    setRegeneratingItem(index);
    const result = await generateQuizDraft(
      buildInput({
        chunks: sourceScope(original.sourceChunkIds),
        instructions: isRu
          ? "Создай ровно один улучшенный вопрос на замену. Дистракторы должны быть правдоподобными, объяснение — только по источникам."
          : "Generate exactly one improved replacement question with plausible distractors and a source-grounded explanation.",
      }),
    );
    setRegeneratingItem(null);
    if (!result.ok || result.data.questions.length === 0) {
      toast.error(result.ok ? t.aiError : result.message);
      return;
    }
    const replacement = result.data.questions[0];
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((question, questionIndex) =>
        questionIndex === index
          ? {
              ...replacement,
              sourceChunkIds: replacement.sourceChunkIds?.length
                ? replacement.sourceChunkIds
                : original.sourceChunkIds,
            }
          : question,
      ),
    });
  };

  const save = () => {
    if (!material || state !== "ready" || saveLocked || !draftValid) return;
    setSaveLocked(true);
    const context = { courseId, topicId, materialId: material.id };

    try {
      if (props.kind === "note" && note) {
        const saved = store.createNote({
          title: note.title || material.title,
          content: note.content,
          tags: note.tags ?? [],
          ...context,
          sourceChunkIds: selected,
        });
        store.recordOutput({ materialId: material.id, type: "note", linkedEntityId: saved.id });
      } else if (props.kind === "flashcards" && cards) {
        for (const card of cards.cards) {
          store.createCard({
            front: card.front,
            back: card.back,
            ...context,
            sourceChunkIds: card.sourceChunkIds?.length ? card.sourceChunkIds : selected,
          });
        }
        store.recordOutput({ materialId: material.id, type: "flashcards" });
      } else if (props.kind === "quiz" && quiz) {
        const saved = store.createQuiz({
          title: quiz.title || `${material.title} — quiz`,
          ...context,
        });
        for (const question of quiz.questions) {
          store.addQuestion({
            quizId: saved.id,
            prompt: question.prompt,
            options: question.options,
            correctIndex: question.correctIndex,
            explanation: question.explanation || undefined,
            sourceChunkIds: question.sourceChunkIds?.length
              ? question.sourceChunkIds
              : selected,
          });
        }
        store.recordOutput({ materialId: material.id, type: "quiz", linkedEntityId: saved.id });
      } else if (props.kind === "presentation" && presentation) {
        const saved = store.createOutline({
          title: presentation.title || material.title,
          ...context,
          slides: presentation.slides.map((slide, index) => ({
            id: `sl_${Date.now()}_${index}`,
            title: slide.title,
            bullets: slide.bullets,
            speakerNotes: slide.speakerNotes,
            sourceChunkIds: slide.sourceChunkIds?.length
              ? slide.sourceChunkIds
              : selected,
            order: index,
          })),
        });
        store.recordOutput({
          materialId: material.id,
          type: "presentation_outline",
          linkedEntityId: saved.id,
        });
      }
      setBaseline(serializedDraft);
      setState("saved");
      toast.success(t.save);
    } catch (saveError) {
      setSaveLocked(false);
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setState("error");
    }
  };

  const sources: AIDraftSource[] = selectedChunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.title || `Chunk ${chunk.order + 1}`,
  }));
  const title =
    props.kind === "note"
      ? t.aiGenerateNote
      : props.kind === "flashcards"
        ? t.aiGenerateFlashcards
        : props.kind === "quiz"
          ? t.aiGenerateQuiz
          : t.aiGeneratePresentation;

  return (
    <AIDraftModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      state={state}
      error={error}
      warnings={warnings}
      sourceChunks={state === "ready" ? sources : undefined}
      onSave={save}
      saveDisabled={saveLocked || !draftValid}
      onRegenerate={selectedChunks.length > 0 ? generate : undefined}
      copyText={props.kind === "note" ? note?.content : undefined}
      dirty={dirty}
    >
      {state === "idle" && (
        <SourceSelection
          configured={aiConfigured}
          materialId={materialId}
          setMaterialId={(value) => {
            setMaterialId(value);
            setSelected([]);
          }}
          chunks={chunks}
          selected={selected}
          toggleChunk={toggleChunk}
          totalChars={totalChars}
          overLimit={overLimit}
          instructions={instructions}
          setInstructions={setInstructions}
          onGenerate={generate}
        />
      )}
      {state === "ready" && props.kind === "note" && note && (
        <NoteDraftEditor draft={note} onChange={setNote} />
      )}
      {state === "ready" && props.kind === "flashcards" && cards && (
        <FlashcardsDraftEditor
          draft={cards}
          onChange={setCards}
          defaultSourceChunkIds={selected}
          regeneratingIndex={regeneratingItem}
          onRegenerateItem={regenerateCard}
        />
      )}
      {state === "ready" && props.kind === "quiz" && quiz && (
        <QuizDraftEditor
          draft={quiz}
          onChange={setQuiz}
          defaultSourceChunkIds={selected}
          regeneratingIndex={regeneratingItem}
          onRegenerateItem={regenerateQuestion}
        />
      )}
      {state === "ready" && props.kind === "presentation" && presentation && (
        <PresentationDraftEditor
          draft={presentation}
          onChange={setPresentation}
          defaultSourceChunkIds={selected}
        />
      )}
      {state === "ready" && !draftValid && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-200">
          {isRu
            ? "Заполни обязательные поля и оставь хотя бы один валидный элемент перед сохранением."
            : "Complete required fields and keep at least one valid item before saving."}
        </div>
      )}
    </AIDraftModal>
  );
}

function SourceSelection({
  configured,
  materialId,
  setMaterialId,
  chunks,
  selected,
  toggleChunk,
  totalChars,
  overLimit,
  instructions,
  setInstructions,
  onGenerate,
}: {
  configured: boolean | null;
  materialId: string;
  setMaterialId: (value: string) => void;
  chunks: MaterialChunk[];
  selected: string[];
  toggleChunk: (id: string) => void;
  totalChars: number;
  overLimit: boolean;
  instructions: string;
  setInstructions: (value: string) => void;
  onGenerate: () => void;
}) {
  const { t } = useApp();
  const data = useData();
  const selectedCount = chunks.filter((chunk) => selected.includes(chunk.id)).length;

  return (
    <div className="space-y-3">
      {configured === false && (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs">
          {t.aiUnavailable}
        </div>
      )}
      <div>
        <Label>{t.aiChooseMaterial}</Label>
        <Select value={materialId} onValueChange={setMaterialId}>
          <SelectTrigger>
            <SelectValue placeholder={t.aiSelectSource} />
          </SelectTrigger>
          <SelectContent>
            {data.materials.map((material) => (
              <SelectItem key={material.id} value={material.id}>
                {material.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {materialId && (
        <div>
          <Label>{t.aiSelectChunks}</Label>
          <div className="max-h-72 space-y-1 overflow-auto rounded-md border border-border bg-background p-1">
            {chunks.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">{t.chunksEmpty}</div>
            )}
            {chunks.map((chunk) => (
              <label
                key={chunk.id}
                className={`flex cursor-pointer gap-2 rounded-md p-2 text-xs ${
                  selected.includes(chunk.id)
                    ? "border border-primary/40 bg-primary/10"
                    : "hover:bg-surface"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.includes(chunk.id)}
                  onChange={() => toggleChunk(chunk.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {chunk.title || `Chunk ${chunk.order + 1}`}
                  </div>
                  <div className="line-clamp-2 whitespace-pre-wrap text-muted-foreground">
                    {chunk.text}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {selectedCount}/{MAX_CHUNKS} · {totalChars.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </div>
          {overLimit && <div className="text-[11px] text-destructive">{t.aiTooManyChars}</div>}
        </div>
      )}
      <div>
        <Label>{t.aiInstructionsOptional}</Label>
        <Textarea
          className="min-h-20 resize-y"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button
          onClick={onGenerate}
          disabled={!configured || selectedCount === 0 || overLimit}
          title={
            !configured
              ? t.aiUnavailable
              : selectedCount === 0
                ? t.aiNoChunksSelected
                : undefined
          }
        >
          <Sparkles className="h-4 w-4 me-1" />
          {t.aiGenerate}
        </Button>
      </div>
    </div>
  );
}

function validateDraft(kind: AIGenerateKind, draft: DraftValue | null): boolean {
  if (!draft) return false;
  if (kind === "note") {
    const value = draft as NoteDraft;
    return Boolean(value.title.trim() && value.content.trim());
  }
  if (kind === "flashcards") {
    const value = (draft as FlashcardsDraft).cards;
    return value.length > 0 && value.every((card) => Boolean(card.front.trim() && card.back.trim()));
  }
  if (kind === "quiz") {
    const value = draft as QuizDraft;
    return (
      Boolean(value.title.trim()) &&
      value.questions.length > 0 &&
      value.questions.every(
        (question) =>
          Boolean(question.prompt.trim()) &&
          question.options.length >= 2 &&
          question.options.every((option) => Boolean(option.trim())) &&
          question.correctIndex >= 0 &&
          question.correctIndex < question.options.length,
      )
    );
  }
  const value = draft as PresentationDraft;
  return (
    Boolean(value.title.trim()) &&
    value.slides.length > 0 &&
    value.slides.every((slide) => Boolean(slide.title.trim()))
  );
}

export function AIGenerateButton(props: {
  kind: AIGenerateKind;
  initialMaterialId?: string;
  initialCourseId?: string;
  initialTopicId?: string;
  initialChunkIds?: string[];
  size?: "default" | "sm";
  variant?: "default" | "outline";
  className?: string;
  label?: string;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    void checkAIStatus().then((status) => setConfigured(status.configured));
  }, []);

  const label =
    props.label ??
    (props.kind === "note"
      ? t.aiGenerateNote
      : props.kind === "flashcards"
        ? t.aiGenerateFlashcards
        : props.kind === "quiz"
          ? t.aiGenerateQuiz
          : t.aiGeneratePresentation);

  return (
    <>
      <Button
        size={props.size}
        variant={props.variant ?? "outline"}
        onClick={() => setOpen(true)}
        disabled={configured === false}
        title={configured === false ? t.aiUnavailable : undefined}
        className={props.className}
      >
        <Sparkles className="h-4 w-4 me-1" />
        {label}
      </Button>
      <AIGenerateDialog
        open={open}
        onOpenChange={setOpen}
        kind={props.kind}
        initialMaterialId={props.initialMaterialId}
        initialCourseId={props.initialCourseId}
        initialTopicId={props.initialTopicId}
        initialChunkIds={props.initialChunkIds}
      />
    </>
  );
}
