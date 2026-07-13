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
  const cards = useMemo(() => {
    const byId = new Map(filteredCards.map((card) => [card.id, card]));
    const ordered = orderIds
      .map((id) => byId.get(id))
      .filter((card): card is Flashcard => Boolean(card));
    const included = new Set(ordered.map((card) => card.id));
    return [...ordered, ...filteredCards.filter((card) => !included.has(card.id))];
  }, [filteredCards, orderIds]);
  const card = cards[index];

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setFinished(false);
    setOrderIds([]);
  }, [courseId, topicId]);

  useEffect(() => {
    if (index >= cards.length) setIndex(Math.max(0, cards.length - 1));
  }, [cards.length, index]);

  useEffect(() => {
    if (view !== "study" || !card || finished) return;
    const onKeyDown = (event: KeyboardEvent) => {
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
        <div className="mx-auto mb-4 flex max-w-[1440px] justify-end">
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

      {cards.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-dashed border-border p-12 text-center">
          <Layers3 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-serif text-xl font-semibold">
            {isRu ? "В этой колоде пока нет карточек" : "This deck has no cards yet"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRu
              ? "Сгенерируй двусторонние карточки из материала или создай их в управлении колодой."
              : "Generate two-sided cards from a material or create them in deck management."}
          </p>
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
          <Button
            className="mt-5"
            onClick={() => {
              setIndex(0);
              setFinished(false);
              setFlipped(false);
            }}
          >
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

          <QuizletFlipCard
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

function QuizletFlipCard({
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
  return (
    <div className="mt-4" style={{ perspective: "1400px" }}>
      <button
        type="button"
        className="block w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={onFlip}
        aria-label={
          flipped
            ? isRu ? "Показать вопрос" : "Show prompt"
            : isRu ? "Показать ответ" : "Show answer"
        }
      >
        <div
          className="relative min-h-[340px] w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <CardFace label={isRu ? "Вопрос" : "Front"} text={card.front} />
          <CardFace
            label={isRu ? "Ответ" : "Back"}
            text={card.back}
            back
          />
        </div>
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {flipped
          ? isRu ? "Нажми, чтобы вернуть вопрос" : "Tap to return to the prompt"
          : isRu ? "Нажми, чтобы перевернуть" : "Tap to flip"}
      </p>
    </div>
  );
}

function CardFace({ label, text, back = false }: { label: string; text: string; back?: boolean }) {
  return (
    <div
      className="absolute inset-0 flex min-h-[340px] flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-10"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : "rotateY(0deg)",
      }}
    >
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="flex flex-1 items-center justify-center">
        <p dir="auto" className="max-w-3xl whitespace-pre-wrap text-center font-serif text-2xl leading-10 md:text-3xl">
          {text}
        </p>
      </div>
    </div>
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
