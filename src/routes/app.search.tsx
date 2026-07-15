import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardList,
  FileText,
  FolderOpen,
  HelpCircle,
  Layers,
  Presentation,
  Puzzle,
  Search as SearchIcon,
  Target,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import {
  countGlobalSearchKinds,
  GLOBAL_SEARCH_KINDS,
  searchWorkspace,
  type GlobalSearchHit,
  type GlobalSearchKind,
  type GlobalSearchRange,
} from "@/lib/global-search";
import { useData } from "@/lib/store";

type Scope = GlobalSearchKind | "all";

interface SearchParams {
  q: string;
  scope: Scope;
  course: string;
}

export const Route = createFileRoute("/app/search")({
  validateSearch: (raw): SearchParams => ({
    q: typeof raw.q === "string" ? raw.q.slice(0, 240) : "",
    scope: isScope(raw.scope) ? raw.scope : "all",
    course: typeof raw.course === "string" && raw.course ? raw.course : "all",
  }),
  component: SearchPage,
});

function SearchPage() {
  const { t, lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/app/search" });
  const inputRef = useRef<HTMLInputElement>(null);

  const courseId = search.course === "all" ? undefined : search.course;
  const allResults = useMemo(
    () => searchWorkspace(data, search.q, { courseId, limit: 500 }),
    [data, search.q, courseId],
  );
  const results = useMemo(
    () =>
      search.scope === "all"
        ? allResults.slice(0, 120)
        : allResults.filter((result) => result.kind === search.scope).slice(0, 120),
    [allResults, search.scope],
  );
  const counts = useMemo(() => countGlobalSearchKinds(allResults), [allResults]);
  const courseById = useMemo(
    () => new Map(data.courses.map((course) => [course.id, course.title])),
    [data.courses],
  );
  const courses = useMemo(
    () =>
      data.courses
        .slice()
        .sort((left, right) =>
          left.title.localeCompare(right.title, undefined, { sensitivity: "base", numeric: true }),
        ),
    [data.courses],
  );

  const labels = useMemo(() => kindLabels(isRu), [isRu]);
  const updateSearch = (patch: Partial<SearchParams>) => {
    void navigate({
      to: "/app/search",
      search: { ...search, ...patch },
      replace: true,
    });
  };

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== "/" ||
        target?.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t.searchNav}
        subtitle={
          isRu
            ? "Мгновенный локальный поиск по источникам, конспектам, карточкам, тестам и структуре курса."
            : "Instant local search across sources, notes, flashcards, quizzes, and course structure."
        }
      />

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="relative">
          <SearchIcon className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus
            className="h-12 ps-10 pe-20 text-base"
            aria-label={t.searchNav}
            placeholder={
              isRu
                ? "Термин, фраза, номер курса…  Кавычки ищут точную фразу"
                : "Term, phrase, course number…  Quotes keep a phrase together"
            }
            value={search.q}
            onChange={(event) => updateSearch({ q: event.target.value })}
          />
          <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {search.q && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label={isRu ? "Очистить поиск" : "Clear search"}
                onClick={() => updateSearch({ q: "", scope: "all" })}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <kbd className="hidden rounded border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground sm:inline">
              /
            </kbd>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex min-w-0 flex-wrap gap-1" aria-label={t.filter}>
            <ScopeButton
              active={search.scope === "all"}
              label={isRu ? "Лучшие" : "Best"}
              count={allResults.length}
              onClick={() => updateSearch({ scope: "all" })}
            />
            {GLOBAL_SEARCH_KINDS.map((kind) => (
              <ScopeButton
                key={kind}
                active={search.scope === kind}
                label={labels[kind]}
                count={counts[kind]}
                onClick={() => updateSearch({ scope: kind })}
              />
            ))}
          </div>

          <Select
            value={search.course}
            onValueChange={(value) => updateSearch({ course: value, scope: "all" })}
          >
            <SelectTrigger aria-label={isRu ? "Фильтр по курсу" : "Course filter"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все курсы" : "All courses"}</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span aria-live="polite">
            {search.q.trim()
              ? isRu
                ? `${results.length}${allResults.length > results.length ? ` из ${allResults.length}` : ""} результатов`
                : `${results.length}${allResults.length > results.length ? ` of ${allResults.length}` : ""} results`
              : isRu
                ? "Поиск работает полностью в этом браузере"
                : "Search runs entirely in this browser"}
          </span>
          <span>
            {isRu
              ? "Все слова обязательны · точные названия выше полного текста"
              : "All terms are required · exact titles rank above full text"}
          </span>
        </div>
      </section>

      {!search.q.trim() ? (
        <SearchEmpty isRu={isRu} />
      ) : results.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <strong>{t.searchNoResults}</strong>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRu
              ? "Убери одно из слов, проверь фильтр курса или верни область «Лучшие»."
              : "Remove one term, check the course filter, or return to Best results."}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => updateSearch({ scope: "all", course: "all" })}
          >
            {isRu ? "Сбросить фильтры" : "Reset filters"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {results.map((result, index) => {
            const Icon = iconFor(result.kind);
            const courseTitle = result.courseId ? courseById.get(result.courseId) : undefined;
            return (
              <article
                key={`${result.kind}_${result.id}`}
                className="group rounded-xl border border-border bg-surface p-4 transition-[border-color,background-color] hover:border-primary/45 hover:bg-accent/20"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-background">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary">
                        {labels[result.kind]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">#{index + 1}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {fieldLabel(result.matchedField, isRu)}
                      </span>
                    </div>
                    <h2 dir="auto" className="mt-1 text-base font-semibold leading-6">
                      <HighlightedText text={result.title || "—"} ranges={result.titleRanges} />
                    </h2>
                    {result.snippet && (
                      <p
                        dir="auto"
                        className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
                      >
                        <HighlightedText text={result.snippet} ranges={result.snippetRanges} />
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {courseTitle && <span>{courseTitle}</span>}
                      {result.sourceTitle && <span>{result.sourceTitle}</span>}
                      {result.pageNumber && (
                        <span>
                          {isRu ? `стр. ${result.pageNumber}` : `p. ${result.pageNumber}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <ResultLink hit={result} label={t.open} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScopeButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="h-8 text-xs"
    >
      {label}
      <span className="ms-1 text-[10px] opacity-65">{count}</span>
    </Button>
  );
}

function SearchEmpty({ isRu }: { isRu: boolean }) {
  const examples = isRu
    ? ["археология Иерусалим", '"система управления"', "מבוא מידע", "615"]
    : ["Jerusalem archaeology", '"information system"', "מבוא מידע", "615"];
  return (
    <section className="mt-4 rounded-xl border border-dashed border-border bg-surface p-8">
      <div className="mx-auto max-w-2xl text-center">
        <SearchIcon className="mx-auto h-9 w-9 text-muted-foreground" />
        <h2 className="mt-3 font-serif text-xl font-semibold">
          {isRu ? "Найди содержимое, а не только файл" : "Find the content, not only the file"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isRu
            ? "Поиск видит заголовки, исходные фрагменты, страницы, конспекты, обе стороны карточек, варианты ответов и объяснения тестов. Иврит ищется одинаково с никудами и без них."
            : "Search includes titles, source chunks, pages, notes, both card sides, quiz options, and explanations. Hebrew matches with or without niqqud."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {examples.map((example) => (
            <span
              key={example}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs"
            >
              {example}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HighlightedText({ text, ranges }: { text: string; ranges: GlobalSearchRange[] }) {
  if (ranges.length === 0) return text;
  const parts: React.ReactNode[] = [];
  let offset = 0;
  for (const range of ranges) {
    if (range.start > offset) parts.push(text.slice(offset, range.start));
    parts.push(
      <mark
        key={`${range.start}-${range.end}`}
        className="rounded-sm bg-primary/20 px-0.5 text-inherit"
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    offset = range.end;
  }
  if (offset < text.length) parts.push(text.slice(offset));
  return parts;
}

function ResultLink({ hit, label }: { hit: GlobalSearchHit; label: string }) {
  const className =
    "shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary hover:border-primary/50 hover:bg-primary/5";
  switch (hit.kind) {
    case "course":
      return (
        <Link to="/app/courses/$courseId" params={{ courseId: hit.id }} className={className}>
          {label}
        </Link>
      );
    case "topic":
      return hit.courseId ? (
        <Link to="/app/courses/$courseId" params={{ courseId: hit.courseId }} className={className}>
          {label}
        </Link>
      ) : null;
    case "material":
      return (
        <Link to="/app/materials/$materialId" params={{ materialId: hit.id }} className={className}>
          {label}
        </Link>
      );
    case "chunk":
      return hit.materialId ? (
        <Link
          to="/app/materials/$materialId"
          params={{ materialId: hit.materialId }}
          className={className}
        >
          {label}
        </Link>
      ) : null;
    case "note":
      return (
        <Link to="/app/notes/$noteId" params={{ noteId: hit.id }} className={className}>
          {label}
        </Link>
      );
    case "flashcard":
      return (
        <Link to="/app/flashcards" className={className}>
          {label}
        </Link>
      );
    case "quiz":
      return (
        <Link to="/app/quizzes/$quizId" params={{ quizId: hit.id }} className={className}>
          {label}
        </Link>
      );
    case "question":
      return hit.quizId ? (
        <Link to="/app/quizzes/$quizId" params={{ quizId: hit.quizId }} className={className}>
          {label}
        </Link>
      ) : null;
    case "assignment":
      return (
        <Link to="/app/assignments" className={className}>
          {label}
        </Link>
      );
    case "outline":
      return (
        <Link
          to="/app/presentations/$outlineId"
          params={{ outlineId: hit.id }}
          className={className}
        >
          {label}
        </Link>
      );
  }
}

function iconFor(kind: GlobalSearchKind) {
  switch (kind) {
    case "course":
      return BookOpen;
    case "topic":
      return Target;
    case "material":
      return FolderOpen;
    case "chunk":
      return Puzzle;
    case "note":
      return FileText;
    case "flashcard":
      return Layers;
    case "quiz":
    case "question":
      return HelpCircle;
    case "assignment":
      return ClipboardList;
    case "outline":
      return Presentation;
  }
}

function kindLabels(isRu: boolean): Record<GlobalSearchKind, string> {
  return isRu
    ? {
        course: "Курсы",
        topic: "Темы",
        material: "Материалы",
        chunk: "Фрагменты",
        note: "Конспекты",
        flashcard: "Карточки",
        quiz: "Тесты",
        question: "Вопросы",
        assignment: "Задания",
        outline: "Презентации",
      }
    : {
        course: "Courses",
        topic: "Topics",
        material: "Materials",
        chunk: "Chunks",
        note: "Notes",
        flashcard: "Flashcards",
        quiz: "Quizzes",
        question: "Questions",
        assignment: "Assignments",
        outline: "Presentations",
      };
}

function fieldLabel(field: string, isRu: boolean): string {
  const labels: Record<string, [string, string]> = {
    title: ["название", "title"],
    originalTitle: ["оригинальное название", "original title"],
    number: ["номер курса", "course number"],
    description: ["описание", "description"],
    instructor: ["преподаватель", "instructor"],
    semester: ["семестр", "semester"],
    tags: ["теги", "tags"],
    summary: ["резюме", "summary"],
    source: ["текст источника", "source text"],
    fileName: ["имя файла", "file name"],
    section: ["раздел", "section"],
    materialTitle: ["материал", "material"],
    content: ["текст конспекта", "note content"],
    front: ["вопрос карточки", "card front"],
    back: ["ответ карточки", "card back"],
    prompt: ["вопрос", "prompt"],
    options: ["варианты ответа", "answer options"],
    explanation: ["объяснение", "explanation"],
    quizTitle: ["название теста", "quiz title"],
    notes: ["заметки", "notes"],
    grade: ["оценка", "grade"],
    slides: ["слайды", "slides"],
  };
  const copy = labels[field] ?? [field, field];
  return isRu ? `совпадение: ${copy[0]}` : `matched: ${copy[1]}`;
}

function isScope(value: unknown): value is Scope {
  return value === "all" || GLOBAL_SEARCH_KINDS.includes(value as GlobalSearchKind);
}
