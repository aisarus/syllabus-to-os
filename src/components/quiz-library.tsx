import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpenCheck,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { store, useData, type QuizQuestion } from "@/lib/store";

export function QuizLibrary() {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return data.quizzes
      .filter(
        (quiz) =>
          courseFilter === "all" ||
          (courseFilter === "_none" ? !quiz.courseId : quiz.courseId === courseFilter),
      )
      .filter(
        (quiz) =>
          materialFilter === "all" ||
          (materialFilter === "_none" ? !quiz.materialId : quiz.materialId === materialFilter),
      )
      .filter((quiz) => !normalized || normalizeText(quiz.title).includes(normalized))
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [data.quizzes, query, courseFilter, materialFilter]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">
            {isRu ? "Студия тестов" : "Quiz Studio"}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {isRu
              ? "Редактируемые банки вопросов с проверкой валидности, источниками и отдельными режимами практики и экзамена."
              : "Editable question banks with validation, source references, and separate practice and exam modes."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AIGenerateButton kind="quiz" />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 me-1" />
                {isRu ? "Новый тест" : "New quiz"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{isRu ? "Создать тест" : "Create quiz"}</DialogTitle>
              </DialogHeader>
              <CreateQuizForm onDone={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="mt-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative">
            <Search className="absolute start-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isRu ? "Поиск по названию" : "Search by title"}
            />
          </div>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все курсы" : "All courses"}</SelectItem>
              <SelectItem value="_none">{isRu ? "Без курса" : "No course"}</SelectItem>
              {data.courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={materialFilter} onValueChange={setMaterialFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все материалы" : "All materials"}</SelectItem>
              <SelectItem value="_none">{isRu ? "Без материала" : "No material"}</SelectItem>
              {data.materials.map((material) => (
                <SelectItem key={material.id} value={material.id}>{material.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {filtered.length} {isRu ? "тестов" : "quizzes"}
        </p>
      </section>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-12 text-center">
          <BookOpenCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <strong className="mt-3 block">
            {data.quizzes.length === 0
              ? isRu ? "Тестов пока нет" : "No quizzes yet"
              : isRu ? "По фильтрам ничего не найдено" : "No quizzes match the filters"}
          </strong>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRu
              ? "Создай пустой банк вопросов или сгенерируй его из выбранного материала."
              : "Create an empty question bank or generate one from selected source material."}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((quiz) => {
            const questions = data.quizQuestions.filter((question) => question.quizId === quiz.id);
            const invalid = questions.filter((question) => !validateQuestion(question).valid).length;
            const attempts = data.quizAttempts.filter((attempt) => attempt.quizId === quiz.id);
            const best = attempts.reduce((maximum, attempt) => Math.max(maximum, attempt.score), 0);
            const course = data.courses.find((item) => item.id === quiz.courseId);
            const material = data.materials.find((item) => item.id === quiz.materialId);
            return (
              <article key={quiz.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start gap-2">
                  <Link
                    to="/app/quizzes/$quizId"
                    params={{ quizId: quiz.id }}
                    className="min-w-0 flex-1"
                  >
                    <h2 className="line-clamp-2 font-serif text-lg font-semibold hover:text-primary">
                      {quiz.title || (isRu ? "Без названия" : "Untitled")}
                    </h2>
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={isRu ? "Удалить тест" : "Delete quiz"}
                    onClick={() => {
                      const confirmed = confirm(
                        isRu
                          ? "Удалить тест, все его вопросы и историю попыток?"
                          : "Delete this quiz, all its questions, and attempt history?",
                      );
                      if (!confirmed) return;
                      store.deleteQuiz(quiz.id);
                      toast.success(isRu ? "Тест удалён" : "Quiz deleted");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                  <span className="rounded border border-border px-2 py-1">
                    {questions.length} {isRu ? "вопросов" : "questions"}
                  </span>
                  <span className="rounded border border-border px-2 py-1">
                    {attempts.length} {isRu ? "попыток" : "attempts"}
                  </span>
                  {attempts.length > 0 && (
                    <span className="rounded border border-border px-2 py-1">
                      {isRu ? "Лучший" : "Best"}: {best}%
                    </span>
                  )}
                  {invalid > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-red-200">
                      <AlertTriangle className="h-3 w-3" />
                      {invalid} {isRu ? "невалидных" : "invalid"}
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <div className="truncate">{course?.title ?? (isRu ? "Без курса" : "No course")}</div>
                  <div className="truncate">{material?.title ?? (isRu ? "Без материала" : "No material")}</div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateQuizForm({ onDone }: { onDone: () => void }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("_none");
  const [topicId, setTopicId] = useState("_none");
  const [materialId, setMaterialId] = useState("_none");
  const topics = data.topics.filter((topic) => courseId !== "_none" && topic.courseId === courseId);
  const materials = data.materials.filter(
    (material) => courseId === "_none" || !material.courseId || material.courseId === courseId,
  );

  return (
    <div className="space-y-4">
      <div>
        <Label>{isRu ? "Название" : "Title"}</Label>
        <Input dir="auto" className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={courseId} onValueChange={(value) => { setCourseId(value); setTopicId("_none"); setMaterialId("_none"); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{isRu ? "Без курса" : "No course"}</SelectItem>
            {data.courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={topicId} onValueChange={setTopicId} disabled={courseId === "_none"}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{isRu ? "Без темы" : "No topic"}</SelectItem>
            {topics.map((topic) => <SelectItem key={topic.id} value={topic.id}>{topic.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={materialId} onValueChange={setMaterialId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{isRu ? "Без материала" : "No material"}</SelectItem>
            {materials.map((material) => <SelectItem key={material.id} value={material.id}>{material.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>{isRu ? "Отмена" : "Cancel"}</Button>
        <Button
          disabled={!title.trim()}
          onClick={() => {
            const quiz = store.createQuiz({
              title: title.trim(),
              courseId: courseId === "_none" ? undefined : courseId,
              topicId: topicId === "_none" ? undefined : topicId,
              materialId: materialId === "_none" ? undefined : materialId,
            });
            onDone();
            window.location.assign(`/app/quizzes/${quiz.id}`);
          }}
        >
          {isRu ? "Создать" : "Create"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function validateQuestion(question: QuizQuestion): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const options = question.options.map((option) => option.trim());
  if (!question.prompt.trim()) errors.push("prompt");
  if (options.length < 2) errors.push("options_count");
  if (options.some((option) => !option)) errors.push("empty_option");
  if (new Set(options.map(normalizeText)).size !== options.length) errors.push("duplicate_options");
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= options.length) {
    errors.push("correct_index");
  }
  return { valid: errors.length === 0, errors };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
