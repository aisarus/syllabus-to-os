import {
  ArrowDown,
  ArrowUp,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import type {
  FlashcardsDraft,
  NoteDraft,
  PresentationDraft,
  QuizDraft,
} from "@/lib/ai";

export function NoteDraftEditor({
  draft,
  onChange,
}: {
  draft: NoteDraft;
  onChange: (draft: NoteDraft) => void;
}) {
  const { t } = useApp();
  return (
    <div className="space-y-3">
      <div>
        <Label>{t.title}</Label>
        <Input
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </div>
      <div>
        <Label>{t.content}</Label>
        <Textarea
          dir="auto"
          className="min-h-[320px] resize-y font-mono text-sm leading-6"
          value={draft.content}
          onChange={(event) => onChange({ ...draft, content: event.target.value })}
        />
      </div>
      <div>
        <Label>{t.tags}</Label>
        <Input
          value={draft.tags.join(", ")}
          onChange={(event) =>
            onChange({
              ...draft,
              tags: event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            })
          }
        />
      </div>
    </div>
  );
}

export function FlashcardsDraftEditor({
  draft,
  onChange,
  defaultSourceChunkIds,
  regeneratingIndex,
  onRegenerateItem,
}: {
  draft: FlashcardsDraft;
  onChange: (draft: FlashcardsDraft) => void;
  defaultSourceChunkIds: string[];
  regeneratingIndex?: number | null;
  onRegenerateItem?: (index: number) => void;
}) {
  const { t, lang } = useApp();
  const isRu = lang === "ru";
  const update = (index: number, patch: Partial<FlashcardsDraft["cards"][number]>) => {
    onChange({
      ...draft,
      cards: draft.cards.map((card, cardIndex) =>
        cardIndex === index ? { ...card, ...patch } : card,
      ),
    });
  };
  const remove = (index: number) =>
    onChange({ ...draft, cards: draft.cards.filter((_, cardIndex) => cardIndex !== index) });
  const move = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= draft.cards.length) return;
    const cards = [...draft.cards];
    [cards[index], cards[target]] = [cards[target], cards[index]];
    onChange({ ...draft, cards });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {draft.cards.length} · {t.flashcards}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...draft,
              cards: [
                ...draft.cards,
                { front: "", back: "", sourceChunkIds: [...defaultSourceChunkIds] },
              ],
            })
          }
        >
          <Plus className="h-3.5 w-3.5 me-1" />
          {t.add}
        </Button>
      </div>

      {draft.cards.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {isRu ? "Добавь хотя бы одну карточку перед сохранением." : "Add at least one card before saving."}
        </div>
      )}

      {draft.cards.map((card, index) => (
        <div key={index} className="space-y-2 rounded-md border border-border bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold">
              {isRu ? "Карточка" : "Card"} {index + 1}
            </span>
            <div className="flex items-center gap-1">
              {onRegenerateItem && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRegenerateItem(index)}
                  disabled={regeneratingIndex !== null && regeneratingIndex !== undefined}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 me-1 ${regeneratingIndex === index ? "animate-spin" : ""}`}
                  />
                  {isRu ? "Заменить через AI" : "Replace with AI"}
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label={isRu ? "Переместить выше" : "Move up"}
                onClick={() => move(index, "up")}
                disabled={index === 0}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={isRu ? "Переместить ниже" : "Move down"}
                onClick={() => move(index, "down")}
                disabled={index === draft.cards.length - 1}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t.delete}
                onClick={() => remove(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <Input
            dir="auto"
            value={card.front}
            onChange={(event) => update(index, { front: event.target.value })}
            placeholder={t.front}
          />
          <Textarea
            dir="auto"
            className="min-h-[90px] resize-y"
            value={card.back}
            onChange={(event) => update(index, { back: event.target.value })}
            placeholder={t.cardBack}
          />
          <div className="text-[10px] text-muted-foreground">
            {(card.sourceChunkIds?.length || defaultSourceChunkIds.length).toLocaleString()} {isRu ? "источников" : "sources"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuizDraftEditor({
  draft,
  onChange,
  defaultSourceChunkIds,
  regeneratingIndex,
  onRegenerateItem,
}: {
  draft: QuizDraft;
  onChange: (draft: QuizDraft) => void;
  defaultSourceChunkIds: string[];
  regeneratingIndex?: number | null;
  onRegenerateItem?: (index: number) => void;
}) {
  const { t, lang } = useApp();
  const isRu = lang === "ru";
  const updateQuestion = (index: number, patch: Partial<QuizDraft["questions"][number]>) => {
    onChange({
      ...draft,
      questions: draft.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    });
  };
  const removeQuestion = (index: number) =>
    onChange({
      ...draft,
      questions: draft.questions.filter((_, questionIndex) => questionIndex !== index),
    });
  const moveQuestion = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= draft.questions.length) return;
    const questions = [...draft.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    onChange({ ...draft, questions });
  };
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const question = draft.questions[questionIndex];
    const options = [...question.options];
    options[optionIndex] = value;
    updateQuestion(questionIndex, { options });
  };
  const removeOption = (questionIndex: number, optionIndex: number) => {
    const question = draft.questions[questionIndex];
    if (question.options.length <= 2) return;
    const options = question.options.filter((_, index) => index !== optionIndex);
    let correctIndex = question.correctIndex;
    if (optionIndex === correctIndex) correctIndex = 0;
    else if (optionIndex < correctIndex) correctIndex -= 1;
    updateQuestion(questionIndex, { options, correctIndex });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>{t.title}</Label>
        <Input
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {draft.questions.length} {isRu ? "вопросов" : "questions"}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...draft,
              questions: [
                ...draft.questions,
                {
                  prompt: "",
                  options: ["", "", "", ""],
                  correctIndex: 0,
                  explanation: "",
                  sourceChunkIds: [...defaultSourceChunkIds],
                },
              ],
            })
          }
        >
          <Plus className="h-3.5 w-3.5 me-1" />
          {t.add}
        </Button>
      </div>

      {draft.questions.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {isRu ? "Добавь хотя бы один вопрос перед сохранением." : "Add at least one question before saving."}
        </div>
      )}

      {draft.questions.map((question, questionIndex) => (
        <div
          key={questionIndex}
          className="space-y-2 rounded-md border border-border bg-background p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold">
              {isRu ? "Вопрос" : "Question"} {questionIndex + 1}
            </span>
            <div className="flex items-center gap-1">
              {onRegenerateItem && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRegenerateItem(questionIndex)}
                  disabled={regeneratingIndex !== null && regeneratingIndex !== undefined}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 me-1 ${regeneratingIndex === questionIndex ? "animate-spin" : ""}`}
                  />
                  {isRu ? "Заменить через AI" : "Replace with AI"}
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label={isRu ? "Переместить выше" : "Move up"}
                onClick={() => moveQuestion(questionIndex, "up")}
                disabled={questionIndex === 0}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={isRu ? "Переместить ниже" : "Move down"}
                onClick={() => moveQuestion(questionIndex, "down")}
                disabled={questionIndex === draft.questions.length - 1}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t.delete}
                onClick={() => removeQuestion(questionIndex)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Input
            dir="auto"
            value={question.prompt}
            onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })}
            placeholder={t.question}
          />

          <div className="space-y-2">
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  aria-label={isRu ? "Правильный ответ" : "Correct answer"}
                  checked={question.correctIndex === optionIndex}
                  onChange={() => updateQuestion(questionIndex, { correctIndex: optionIndex })}
                />
                <Input
                  dir="auto"
                  value={option}
                  onChange={(event) =>
                    updateOption(questionIndex, optionIndex, event.target.value)
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={isRu ? "Удалить вариант" : "Remove option"}
                  disabled={question.options.length <= 2}
                  onClick={() => removeOption(questionIndex, optionIndex)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                updateQuestion(questionIndex, {
                  options: [...question.options, ""],
                })
              }
            >
              <Plus className="h-3.5 w-3.5 me-1" />
              {isRu ? "Добавить вариант" : "Add option"}
            </Button>
          </div>

          <Textarea
            dir="auto"
            className="min-h-[80px] resize-y text-xs"
            value={question.explanation}
            onChange={(event) =>
              updateQuestion(questionIndex, { explanation: event.target.value })
            }
            placeholder={t.explanation}
          />
          <div className="text-[10px] text-muted-foreground">
            {(question.sourceChunkIds?.length || defaultSourceChunkIds.length).toLocaleString()} {isRu ? "источников" : "sources"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PresentationDraftEditor({
  draft,
  onChange,
  defaultSourceChunkIds,
}: {
  draft: PresentationDraft;
  onChange: (draft: PresentationDraft) => void;
  defaultSourceChunkIds: string[];
}) {
  const { t, lang } = useApp();
  const isRu = lang === "ru";
  const updateSlide = (index: number, patch: Partial<PresentationDraft["slides"][number]>) =>
    onChange({
      ...draft,
      slides: draft.slides.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, ...patch } : slide,
      ),
    });
  const removeSlide = (index: number) =>
    onChange({ ...draft, slides: draft.slides.filter((_, slideIndex) => slideIndex !== index) });
  const moveSlide = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= draft.slides.length) return;
    const slides = [...draft.slides];
    [slides[index], slides[target]] = [slides[target], slides[index]];
    onChange({ ...draft, slides });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>{t.title}</Label>
        <Input
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </div>
      {draft.slides.map((slide, index) => (
        <div key={index} className="space-y-2 rounded-md border border-border bg-background p-3">
          <div className="flex gap-2">
            <Input
              value={slide.title}
              onChange={(event) => updateSlide(index, { title: event.target.value })}
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={isRu ? "Переместить выше" : "Move up"}
              onClick={() => moveSlide(index, "up")}
              disabled={index === 0}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={isRu ? "Переместить ниже" : "Move down"}
              onClick={() => moveSlide(index, "down")}
              disabled={index === draft.slides.length - 1}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => removeSlide(index)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Textarea
            className="min-h-[80px] resize-y text-xs"
            value={slide.bullets.join("\n")}
            onChange={(event) => updateSlide(index, { bullets: event.target.value.split("\n") })}
          />
          <Textarea
            className="min-h-[60px] resize-y text-xs"
            value={slide.speakerNotes}
            onChange={(event) => updateSlide(index, { speakerNotes: event.target.value })}
            placeholder={t.speakerNotes}
          />
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onChange({
            ...draft,
            slides: [
              ...draft.slides,
              {
                title: isRu ? "Новый слайд" : "New slide",
                bullets: [],
                speakerNotes: "",
                sourceChunkIds: [...defaultSourceChunkIds],
              },
            ],
          })
        }
      >
        <Plus className="h-3.5 w-3.5 me-1" />
        {t.add}
      </Button>
    </div>
  );
}
