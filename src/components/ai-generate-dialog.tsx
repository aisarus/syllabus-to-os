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

interface Props {
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

export function AIGenerateDialog(props: Props) {
  const { t, lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const [materialId, setMaterialId] = useState(props.initialMaterialId ?? "");
  const [selected, setSelected] = useState<string[]>(props.initialChunkIds ?? []);
  const [instructions, setInstructions] = useState("");
  const [state, setState] = useState<AIDraftState>("idle");
  const [error, setError] = useState("");
  const [note, setNote] = useState<NoteDraft | null>(null);
  const [cards, setCards] = useState<FlashcardsDraft | null>(null);
  const [quiz, setQuiz] = useState<QuizDraft | null>(null);
  const [presentation, setPresentation] = useState<PresentationDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [baseline, setBaseline] = useState("");
  const [saveLocked, setSaveLocked] = useState(false);
  const [regeneratingItem, setRegeneratingItem] = useState<number | null>(null);

  useEffect(() => {
    if (props.open) {
      void checkAIStatus().then((status) => setAiConfigured(status.configured));
    }
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    setMaterialId(props.initialMaterialId ?? "");
    setSelected(props.initialChunkIds ?? []);
    setInstructions("");
    setState("idle");
    setError("");
    setNote(null);
    setCards(null);
    setQuiz(null);
    setPresentation(null);
    setWarnings([]);
    setBaseline("");
    setSaveLocked(false);
    setRegeneratingItem(null);
  }, [props.open, props.initialMaterialId, props.initialChunkIds]);

  const material = data.materials.find((item) => item.id === materialId) ?? null;
  const chunks: MaterialChunk[] = material ? getChunksByMaterial(data, material.id) : [];
  const selectedChunks = chunks.filter((c) => selected.includes(c.id));
  const totalChars = selectedChunks.reduce((total, chunk) => total + chunk.text.length, 0);
  const overLimit = totalChars > 20_000;
  const courseId = props.initialCourseId ?? material?.courseId;
  const topicId = props.initialTopicId ?? material?.topicId;
  const course = data.courses.find((item) => item.id === courseId);
  const topic = data.topics.find((item) => item.id === topicId);

  const currentDraft = useMemo(() => {
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

  const inputPayload = (overrides?: { chunks?: MaterialChunk[]; instructions?: string }) => ({
    locale: lang,
    targetLanguage: lang,
    course: course ? { id: course.id, title: course.title, number: course.number } : undefined,
    topic: topic ? { id: topic.id, title: topic.title } : undefined,
    material: material
      ? { id: material.id, title: material.title, type: material.type }
      : undefined,
    chunks: (overrides?.chunks ?? selectedChunks).map<AIChunkInput>((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
      section: chunk.section,
    })),
    instructions: overrides?.instructions ?? instructions.trim() || undefined,
  });

  const applyGeneratedDraft = (
    kind: AIGenerateKind,
    draft: NoteDraft | FlashcardsDraft | QuizDraft | PresentationDraft,
  ) => {
    setNote(kind === "note" ? (draft as NoteDraft) : null);
    setCards(kind === "flashcards" ? (draft as FlashcardsDraft) : null);
    setQuiz(kind === "quiz" ? (draft as QuizDraft) : null);
    setPresentation(kind === "presentation" ? (draft as PresentationDraft) : null);
    setWarnings(draft.warnings ?? []);
    setBaseline(JSON.stringify(draft));
    setSaveLocked(false);
    setState("ready");
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
    const input = inputPayload();

    if (props.kind === "note") {
      const result = await generateNoteDraft(input);
      if (result.ok) applyGeneratedDraft("note", result.data);
      else {
        setError(result.message);
        setState("error");
      }
      return;
    }
    if (props.kind === "flashcards") {
      const result = await generateFlashcardsDraft(input);
      if (result.ok) applyGeneratedDraft("flashcards", result.data);
      else {
        setError(result.message);
        setState("error");
      }
      return;
    }
    if (props.kind === "quiz") {
      const result = await generateQuizDraft(input);
      if (result.ok) applyGeneratedDraft("quiz", result.data);
      else {
        setError(result.message);
        setState("error");
      }
      return;
    }

    const result = await generatePresentationOutlineDraft(input);
    if (result.ok) applyGeneratedDraft("presentation", result.data);
    else {
      setError(result.message);
      setState("error");
    }
  };

  const regenerateCard = async (index: number) => {
    if (!cards || regeneratingItem !== null) return;
    const card = cards.cards[index];
    const scopedChunks = selectedChunks.filter((chunk) =>
      card.sourceChunkIds?.includes(chunk.id),
    );
    setRegeneratingItem(index);
    const result = await generateFlashcardsDraft(
      inputPayload({
        chunks: scopedChunks.length > 0 ? scopedChunks : selectedChunks,
        instructions: isRu
          ? "Создай ровно одну улучшенную карточку на замену выбранной. Она должна быть атомарной, понятной и опираться только на источники."
          : "Generate exactly one improved replacement flashcard. Keep it atomic, clear, and grounded only in the sources.",
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
      cards: cards.cards.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...replacement,
              sourceChunkIds: replacement.sourceChunkIds?.length
                ? replacement.sourceChunkIds
                : card.sourceChunkIds,
            }
          : item,
      ),
    });
  };

  const regenerateQuestion = async (index: number) => {
    if (!quiz || regeneratingItem !== null) return;
    const question = quiz.questions[index];
    const scopedChunks = selectedChunks.filter((chunk) =>
      question.sourceChunkIds?.includes(chunk.id),
    );
    setRegeneratingItem(index);
    const result = await generateQuizDraft(
      inputPayload({
        chunks: scopedChunks.length > 0 ? scopedChunks : selectedChunks,
        instructions: isRu
          ? "Создай ровно один улучшенный вопрос на замену выбранному. Неправильные варианты должны быть правдоподобными, а объяснение — опираться только на источники."
          : "Generate exactly one improved replacement question. Distractors must be plausible and the explanation must rely only on the sources.",
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
      questions: quiz.questions.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...replacement,
              sourceChunkIds: replacement.sourceChunkIds?.length
                ? replacement.sourceChunkIds
                : question.sourceChunkIds,
            }
          : item,
      ),
    });
  };

  const chunkSources: AIDraftSource[] = selectedChunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.title || `Chunk ${chunk.order + 1}`,
  }));

  const save = () => {
    if (!material || state !== "ready" || saveLocked || !draftValid) return;
    setSaveLocked(true);
    const context = {
      courseId,
      topicId,
      materialId: material.id,
    };

    try {
      if (props.kind === "note" && note) {
        const savedNote = store.createNote({
          title: note.title || material.title,
          content: note.content,
          tags: note.tags ?? [],
          ...context,
          sourceChunkIds: selected,
        });
        store.recordOutput({ materialId: material.id, type: "note", linkedEntityId: savedNote.id });
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
        const savedQuiz = store.createQuiz({
          title: quiz.title || `${material.title} — quiz`,
          ...context,
        });
        for (const question of quiz.questions) {
          store.addQuestion({
            quizId: savedQuiz.id,
            prompt: question.prompt,
            options: question.options,
            correctIndex: question.correctIndex,
            explanation: question.explanation || undefined,
            sourceChunkIds: question.sourceChunkIds?.length
              ? question.sourceChunkIds
              : selected,
          });
        }
        store.recordOutput({ materialId: material.id, type: "quiz", linkedEntityId: savedQuiz.id });
      } else if (props.kind === "presentation" && presentation) {
        const outline = store.createOutline({
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
          linkedEntityId: outline.id,
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

  const title =
    props.kind === "note"
      ? t.aiGenerateNote
      : props.kind === "flashcards"
        ? t.aiGenerateFlashcards
        : props.kind === "quiz"
          ? t.aiGenerateQuiz
          : t.aiGeneratePresentation;

  const editor =
    state === "ready" ? (
      <div className="space-y-3">
        {props.kind === "note" && note && (
          <NoteDraftEditor draft={note} onChange={setNote} />
        )}
        {props.kind === "flashcards" && cards && (
          <FlashcardsDraftEditor
            draft={cards}
            onChange={setCards}
            defaultSourceChunkIds={selected}
            regeneratingIndex={regeneratingItem}
            onRegenerateItem={regenerateCard}
          />
        )}
        {props.kind === "quiz" && quiz && (
          <QuizDraftEditor
            draft={quiz}
            onChange={setQuiz}
            defaultSourceChunkIds={selected}
            regeneratingIndex={regeneratingItem}
            onRegenerateItem={regenerateQuestion}
          />
        )}
        {props.kind === "presentation" && presentation && (
          <PresentationDraftEditor
            draft={presentation}
            onChange={setPresentation}
            defaultSourceChunkIds={selected}
          />
        )}
        {!draftValid && (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-200">
            {isRu
              ? "Заполни обязательные поля и оставь хотя бы один валидный элемент перед сохранением."
              : "Complete the required fields and keep at least one valid item before saving."}
          </div>
        )}
      </div>
    ) : null;

  return (
    <AIDraftModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      state={state}
      error={error}
      warnings={warnings}
      sourceChunks={state === "ready" ? chunkSources : undefined}
      onSave={save}
      saveDisabled={saveLocked || !draftValid}
      onRegenerate={selectedChunks.length > 0 ? generate : undefined}
      copyText={props.kind === "note" ? note?.content : undefined}
      dirty={dirty}
    >
      {state === "idle" && (
        <div className="space-y-3">
          {aiConfigured === false && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs">
              {t.aiUnavailable}
            </div>
          )}
          <div>
            <Label>{t.aiChooseMaterial}</Label>
            <Select
              value={materialId}
              onValueChange={(value) => {
                setMaterialId(value);
                setSelected([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.aiSelectSource} />
              </SelectTrigger>
              <SelectContent>
                {data.materials.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {material && (
            <div>
              <Label>{t.aiSelectChunks}</Label>
              <div className="max-h-72 space-y-1 overflow-auto rounded-md border border-border bg-background p-1">
                {chunks.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    {t.chunksEmpty}
                  </div>
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
                {selectedChunks.length}/{MAX_CHUNKS} · {totalChars.toLocaleString()} /{" "}
                {MAX_CHARS.toLocaleString()}
              </div>
              {overLimit && (
                <div className="text-[11px] text-destructive">{t.aiTooManyChars}</div>
              )}
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
              onClick={generate}
              disabled={!aiConfigured || selectedChunks.length === 0 || overLimit}
              title={
                !aiConfigured
                  ? t.aiUnavailable
                  : selectedChunks.length === 0
                    ? t.aiNoChunksSelected
                    : undefined
              }
            >
              <Sparkles className="h-4 w-4 me-1" />
              {t.aiGenerate}
            </Button>
          </div>
        </div>
      )}
      {editor}
    </AIDraftModal>
  );
}

function validateDraft(
  kind: AIGenerateKind,
  draft: NoteDraft | FlashcardsDraft | QuizDraft | PresentationDraft | null,
): boolean {
  if (!draft) return false;
  if (kind === "note") {
    const note = draft as NoteDraft;
    return Boolean(note.title.trim() && note.content.trim());
  }
  if (kind === "flashcards") {
    const cards = (draft as FlashcardsDraft).cards;
    return cards.length > 0 && cards.every((card) => card.front.trim() && card.back.trim());
  }
  if (kind === "quiz") {
    const quiz = draft as QuizDraft;
    return (
      Boolean(quiz.title.trim()) &&
      quiz.questions.length > 0 &&
      quiz.questions.every(
        (question) =>
          Boolean(question.prompt.trim()) &&
          question.options.length >= 2 &&
          question.options.every((option) => Boolean(option.trim())) &&
          question.correctIndex >= 0 &&
          question.correctIndex < question.options.length,
      )
    );
  }
  const presentation = draft as PresentationDraft;
  return (
    Boolean(presentation.title.trim()) &&
    presentation.slides.length > 0 &&
    presentation.slides.every((slide) => Boolean(slide.title.trim()))
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
