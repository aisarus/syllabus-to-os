import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { useData, searchAll, type SearchHit } from "@/lib/store";
import {
  Search as SearchIcon,
  BookOpen,
  FileText,
  Layers,
  HelpCircle,
  ClipboardList,
  Presentation,
  FolderOpen,
  Puzzle,
  Target,
} from "lucide-react";

export const Route = createFileRoute("/app/search")({
  component: SearchPage,
});

type Scope = SearchHit["kind"] | "all";

function iconFor(kind: SearchHit["kind"]) {
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

function SearchPage() {
  const { t, lang } = useApp();
  const data = useData();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");

  const results = useMemo(() => searchAll(data, query, 500), [data, query]);
  const filtered = scope === "all" ? results : results.filter((result) => result.kind === scope);
  const kinds: Scope[] = [
    "all",
    "course",
    "topic",
    "material",
    "chunk",
    "note",
    "flashcard",
    "quiz",
    "question",
    "assignment",
    "outline",
  ];
  const labels: Record<Scope, string> =
    lang === "ru"
      ? {
          all: "Все",
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
          all: "All",
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

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={t.searchNav}
        subtitle={
          lang === "ru"
            ? "Ищи по курсам, материалам, фрагментам, конспектам, карточкам и вопросам."
            : "Search courses, materials, chunks, notes, flashcards, and questions."
        }
      />
      <div className="relative mb-3">
        <SearchIcon className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          className="ps-8 h-11 text-base"
          placeholder={t.searchPlaceholderGlobal}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1 mb-4" aria-label={t.filter}>
        {kinds.map((kind) => (
          <Button
            key={kind}
            size="sm"
            variant={scope === kind ? "default" : "outline"}
            onClick={() => setScope(kind)}
            className="h-7 text-xs"
          >
            {labels[kind]}
            {kind !== "all" && (
              <span className="ms-1 text-[10px] opacity-60">
                {results.filter((result) => result.kind === kind).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {!query.trim() ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {lang === "ru"
            ? "Введи слово, термин, название курса или фразу из материала."
            : "Enter a term, course title, or phrase from a source."}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <strong>{t.searchNoResults}</strong>
          <p className="mt-1 text-sm text-muted-foreground">
            {lang === "ru" ? "Измени запрос или выбери область «Все»." : "Change the query or select the All scope."}
          </p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => { setQuery(""); setScope("all"); }}>
            {lang === "ru" ? "Очистить поиск" : "Clear search"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((result) => {
            const Icon = iconFor(result.kind);
            return (
              <div
                key={`${result.kind}_${result.id}`}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {labels[result.kind]}
                      </span>
                      <div className="font-semibold truncate">{result.title || "—"}</div>
                    </div>
                    {result.snippet && (
                      <div className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap mt-1">
                        {result.snippet}
                      </div>
                    )}
                  </div>
                  <ResultLink hit={result} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultLink({ hit }: { hit: SearchHit }) {
  const { t } = useApp();
  const className = "text-xs text-primary hover:underline whitespace-nowrap";
  switch (hit.kind) {
    case "course":
      return (
        <Link to="/app/courses/$courseId" params={{ courseId: hit.id }} className={className}>
          {t.open}
        </Link>
      );
    case "topic":
      return hit.courseId ? (
        <Link to="/app/courses/$courseId" params={{ courseId: hit.courseId }} className={className}>
          {t.open}
        </Link>
      ) : null;
    case "material":
      return (
        <Link to="/app/materials/$materialId" params={{ materialId: hit.id }} className={className}>
          {t.open}
        </Link>
      );
    case "chunk":
      return (
        <Link
          to="/app/materials/$materialId"
          params={{ materialId: hit.materialId }}
          className={className}
        >
          {t.open}
        </Link>
      );
    case "note":
      return (
        <Link to="/app/notes/$noteId" params={{ noteId: hit.id }} className={className}>
          {t.open}
        </Link>
      );
    case "flashcard":
      return (
        <Link to="/app/flashcards" className={className}>
          {t.open}
        </Link>
      );
    case "quiz":
      return (
        <Link to="/app/quizzes/$quizId" params={{ quizId: hit.id }} className={className}>
          {t.open}
        </Link>
      );
    case "question":
      return (
        <Link to="/app/quizzes/$quizId" params={{ quizId: hit.quizId }} className={className}>
          {t.open}
        </Link>
      );
    case "assignment":
      return (
        <Link to="/app/assignments" className={className}>
          {t.open}
        </Link>
      );
    case "outline":
      return (
        <Link
          to="/app/presentations/$outlineId"
          params={{ outlineId: hit.id }}
          className={className}
        >
          {t.open}
        </Link>
      );
  }
}
