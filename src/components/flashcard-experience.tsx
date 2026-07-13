import {
  Check,
  ChevronLeft,
  ChevronRight,
  Layers3,
  RotateCcw,
  Settings2,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { FlashcardStudio } from "@/components/flashcard-studio";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { store, useData, type Flashcard } from "@/lib/store";

export function FlashcardExperience() {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const [view, setView] = useState<"study" | "manage">("study");
  const [courseId, setCourseId] = useState("all");
  const [topicId, setTopicId] = useState("all");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);

  const topics = data.topics.filter(
    (topic) => courseId === "all" || topic.courseId === courseId,
  );
  const filteredCards = useMemo(
    () =>
      data.flashcards
        .filter((card) => courseId === "all" || card.courseId === courseId)
        .filter((card) => topicId === "all" || card.topicId === topicId)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt),
    [data.flashcards, courseId, topicId],
  );
  const dueCards = useMemo(
    () => data.flashcards.filter((card) => card.dueAt <= Date.now()),
    [data.flashcards],
  );
  const activeCards = useMemo(
    () =>
      reviewOnly
        ? filteredCards.filter((card) => card.dueAt <= Date.now())
        : filteredCards,
    [filteredCards, reviewOnly],
  );
  const cards = useMemo(() => {
    const byId = new Map(activeCards.map((card) => [card.id, card]));
    const ordered = orderIds
      .map((id) => byId.get(id))
      .filter((card): card is Flashcard => Boolean(card));
    const included = new Set(ordered.map((card) => card.id));
    return [...ordered, ...activeCards.filter((card) => !included.has(card.id))];
  }, [activeCards, orderIds]);
  const card = cards[index];

  const resetSession = () => {
    setIndex(0);
    setFlipped(false);
    setFinished(false);
    setOrderIds([]);
  };

  const startReview = () => {
    if (dueCards.length === 0) {
      toast.info(
        isRu ? "Сейчас нет карточек к повторению" : "No cards are due right now",
      );
      return;
    }
    setView("study");
    setCourseId("all");
    setTopicId("all");
    setReviewOnly(true);
    resetSession();
  };

  useEffect(() => {
    resetSession();
  }, [courseId, topicId, reviewOnly]);

  useEffect(() => {
    if (index >= cards.length) setIndex(Math.max(0, cards.length - 1));
  }, [cards.length, index]);

  useEffect(() => {
    if (view !== "study" || !card || finished) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === " ") {
        event.preventDefault();
        setFlipped((value) => !value);
      }
      if (event.key === "ArrowLeft" && index > 0) {
        setIndex((value) => value - 1);
        setFlipped(false);
      }
      if (event.key === "ArrowRight" && index < cards.length - 1) {
        setIndex((value) => value + 1);
        setFlipped(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, card, finished, index, cards.length]);

  const advance = (quality: "again" | "good") => {
    if (!card) return;
    store.reviewCard(card.id, quality);
    toast.success(
      quality === "again"
        ? isRu
          ? "Вернём карточку на повторение"
          : "Card returned to learning"
        : isRu
          ? "Отмечено: знаю"
          : "Marked as known",
    );
    if (index >= cards.length - 1) {
      setFinished(true);
      setFlipped(false);
    } else {
      setIndex((value) => value + 1);
      setFlipped(false);
    }
  };

  if (view === "manage") {
    return (
      <div>
        <div className="mx-auto mb-4 flex max-w-[1440px] flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={startReview}>
            <RotateCcw className="h-4 w-4 me-1" />
            {isRu ? "Повторить" : "Review"} ({dueCards.length})
          </Button>
          <Button variant="outline" onClick={() => setView("study")}>
            <Layers3 className="h-4 w-4 me-1" />
            {isRu ? "Вернуться к карточкам" : "Back to study deck"}
          </Button>
        </div>
        <FlashcardStudio />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {isRu ? "Двусторонние карточки" : "Two-sided flashcards"}
          </div>
          <h1 className="mt-2 font-serif text-3xl font-semibold">
            {isRu ? "Учебная колода" : "Study deck"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {isRu
              ? "Нажми на карточку, чтобы перевернуть её. Лицевая сторона — вопрос, обратная — ответ. Пробел тоже переворачивает карточку."
              : "Tap a card to flip it. The front contains the prompt and the back contains the answer. Space also flips the card."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AIGenerateButton kind="flashcards" />
          <Button variant="outline" onClick={startReview}>
            <RotateCcw className="h-4 w-4 me-1" />
            {isRu ? "Повторить" : "Review"} ({dueCards.length})
          </Button>
          <Button variant="outline" onClick={() => setView("manage")}>
            <Settings2 className="h-4 w-4 me-1" />
            {isRu ? "Управление колодой" : "Manage deck"}
          </Button>
        </div>
      </header>

      <section className="mt-5 grid gap-2 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
        <Select
          value={courseId}
          onValueChange={(value) => {
            setCourseId(value);
            setTopicId("all");
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRu ? "Все курсы" : "All courses"}</SelectItem>
            {data.courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={topicId} onValueChange={setTopicId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRu ? "Все темы" : "All topics"}</SelectItem>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>{topic.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {reviewOnly && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
          <span>{isRu ? "Показываются только карточки к повторению" : "Showing due cards only"}</span>
          <Button size="sm" variant="ghost" onClick={() => setReviewOnly(false)}>
            {isRu ? "Вся колода" : "Full deck"}
          </Button>
        </div>
      )}

      {cards.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-dashed border-border p-12 text-center">
          <Layers3 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-serif text-xl font-semibold">
            {reviewOnly
              ? isRu ? "Карточек к повторению нет" : "No cards are due"
              : isRu ? "В этой колоде пока нет карточек" : "This deck has no cards yet"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {reviewOnly
              ? isRu ? "Можно вернуться ко всей колоде." : "Return to the full deck."
              : isRu
                ? "Сгенерируй двусторонние карточки из материала или создай их в управлении колодой."
                : "Generate two-sided cards from a material or create them in deck management."}
          </p>
          {reviewOnly && (
            <Button className="mt-4" variant="outline" onClick={() => setReviewOnly(false)}>
              {isRu ? "Открыть всю колоду" : "Open full deck"}
            </Button>
          )}
        </section>
      ) : finished ? (
        <section className="mt-5 rounded-2xl border border-border bg-surface p-10 text-center">
          <Check className="mx-auto h-12 w-12 text-emerald-300" />
          <h2 className="mt-4 font-serif text-2xl font-semibold">
            {isRu ? "Колода пройдена" : "Deck complete"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRu
              ? `${cards.length} карточек просмотрено. Оценки сохранены в интервальном повторении.`
              : `${cards.length} cards reviewed. Ratings were saved to spaced repetition.`}
          </p>
          <Button className="mt-5" onClick={resetSession}>
            <RotateCcw className="h-4 w-4 me-1" />
            {isRu ? "Пройти ещё раз" : "Study again"}
          </Button>
        </section>
      ) : card ? (
        <>
          <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{index + 1} / {cards.length}</span>
            <span>{flipped ? (isRu ? "Ответ" : "Answer") : isRu ? "Вопрос" : "Prompt"}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${((index + 1) / cards.length) * 100}%` }}
            />
          </div>

          <StableFlashcard
            card={card}
            flipped={flipped}
            onFlip={() => setFlipped((value) => !value)}
            isRu={isRu}
          />

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              variant="destructive"
              disabled={!flipped}
              onClick={() => advance("again")}
            >
              <X className="h-4 w-4 me-1" />
              {isRu ? "Повторить" : "Again"}
            </Button>
            <Button disabled={!flipped} onClick={() => advance("good")}>
              <Check className="h-4 w-4 me-1" />
              {isRu ? "Знаю" : "Know"}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              disabled={index === 0}
              onClick={() => {
                setIndex((value) => value - 1);
                setFlipped(false);
              }}
            >
              <ChevronLeft className="h-4 w-4 me-1" />
              {isRu ? "Назад" : "Previous"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const ids = shuffle(cards.map((item) => item.id));
                setOrderIds(ids);
                setIndex(0);
                setFlipped(false);
                setFinished(false);
              }}
            >
              <Shuffle className="h-4 w-4 me-1" />
              {isRu ? "Перемешать" : "Shuffle"}
            </Button>
            <Button
              variant="ghost"
              disabled={index >= cards.length - 1}
              onClick={() => {
                setIndex((value) => value + 1);
                setFlipped(false);
              }}
            >
              {isRu ? "Вперёд" : "Next"}
              <ChevronRight className="h-4 w-4 ms-1" />
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StableFlashcard({
  card,
  flipped,
  onFlip,
  isRu,
}: {
  card: Flashcard;
  flipped: boolean;
  onFlip: () => void;
  isRu: boolean;
}) {
  const label = flipped ? (isRu ? "Ответ" : "Back") : isRu ? "Вопрос" : "Front";
  const text = flipped ? card.back : card.front;
  return (
    <button
      type="button"
      className="group mt-4 flex min-h-[360px] w-full flex-col rounded-2xl border border-border bg-surface p-6 text-start shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:p-10"
      onClick={onFlip}
      aria-label={
        flipped
          ? isRu ? "Показать вопрос" : "Show prompt"
          : isRu ? "Показать ответ" : "Show answer"
      }
    >
      <div className="flex w-full items-center justify-between gap-3 border-b border-border pb-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        <span className="normal-case tracking-normal">
          {flipped
            ? isRu ? "Нажми, чтобы вернуть вопрос" : "Tap to return to the prompt"
            : isRu ? "Нажми, чтобы показать ответ" : "Tap to reveal the answer"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center py-8">
        <p
          dir="auto"
          className="max-h-[420px] w-full max-w-3xl overflow-y-auto whitespace-pre-wrap text-center font-serif text-2xl leading-10 md:text-3xl"
        >
          {text}
        </p>
      </div>
    </button>
  );
}

function shuffle<T>(values: T[]): T[] {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
