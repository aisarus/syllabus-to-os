import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  FileInput,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { store, useData, type Course } from "@/lib/store";

export function CourseLibrary() {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");

  const semesters = useMemo(
    () =>
      Array.from(
        new Set(data.courses.map((course) => course.semester?.trim()).filter(Boolean)),
      ).sort() as string[],
    [data.courses],
  );

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return data.courses
      .filter((course) => semesterFilter === "all" || course.semester === semesterFilter)
      .filter(
        (course) =>
          programFilter === "all" ||
          (programFilter === "_none" ? !course.programId : course.programId === programFilter),
      )
      .filter(
        (course) =>
          !normalized ||
          [
            course.title,
            course.originalTitle,
            course.number,
            course.instructor,
            course.description,
          ].some((value) => normalizeText(value ?? "").includes(normalized)),
      )
      .slice()
      .sort((left, right) => left.order - right.order);
  }, [data.courses, query, semesterFilter, programFilter]);

  const openCreate = () => {
    setEditId(undefined);
    setDialogOpen(true);
  };

  const openEdit = (courseId: string) => {
    setEditId(courseId);
    setDialogOpen(true);
  };

  const deleteCourseSafely = (course: Course) => {
    const confirmed = confirm(
      isRu
        ? `Удалить курс «${course.title}»? Темы будут удалены, но материалы, конспекты, карточки, тесты и презентации останутся в библиотеке без привязки к курсу.`
        : `Delete “${course.title}”? Topics will be deleted, but materials, notes, flashcards, quizzes, and presentations remain in the library without a course link.`,
    );
    if (!confirmed) return;

    for (const material of data.materials.filter((item) => item.courseId === course.id)) {
      store.updateMaterial(material.id, { courseId: undefined, topicId: undefined });
    }
    for (const note of data.notes.filter((item) => item.courseId === course.id)) {
      store.updateNote(note.id, { courseId: undefined, topicId: undefined });
    }
    for (const card of data.flashcards.filter((item) => item.courseId === course.id)) {
      store.updateCard(card.id, { courseId: undefined, topicId: undefined });
    }
    for (const quiz of data.quizzes.filter((item) => item.courseId === course.id)) {
      store.updateQuiz(quiz.id, { courseId: undefined, topicId: undefined });
    }
    for (const outline of data.presentationOutlines.filter((item) => item.courseId === course.id)) {
      store.updateOutline(outline.id, { courseId: undefined, topicId: undefined });
    }
    store.deleteCourse(course.id);
    toast.success(isRu ? "Курс удалён, контент сохранён" : "Course deleted; content preserved");
  };

  const hasFilters = Boolean(query.trim()) || semesterFilter !== "all" || programFilter !== "all";

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{isRu ? "Курсы" : "Courses"}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {isRu
              ? "Курсы объединяют силлабус, темы, источники и созданные учебные материалы — без искусственных статусов прогресса."
              : "Courses connect syllabi, topics, sources, and study outputs without artificial progress statuses."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/import-syllabus"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent"
          >
            <FileInput className="h-4 w-4 me-1" />
            {isRu ? "Импортировать силлабус" : "Import syllabus"}
          </Link>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditId(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 me-1" />
                {isRu ? "Новый курс" : "New course"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90svh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editId
                    ? isRu ? "Редактировать курс" : "Edit course"
                    : isRu ? "Создать курс" : "Create course"}
                </DialogTitle>
              </DialogHeader>
              <CourseForm
                key={editId ?? "new"}
                courseId={editId}
                onDone={() => {
                  setDialogOpen(false);
                  setEditId(undefined);
                }}
              />
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
              placeholder={isRu ? "Поиск по курсам" : "Search courses"}
            />
          </div>
          <Select value={semesterFilter} onValueChange={setSemesterFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все семестры" : "All semesters"}</SelectItem>
              {semesters.map((semester) => (
                <SelectItem key={semester} value={semester}>{semester}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRu ? "Все программы" : "All programs"}</SelectItem>
              <SelectItem value="_none">{isRu ? "Без программы" : "No program"}</SelectItem>
              {data.programs.map((program) => (
                <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{filtered.length} {isRu ? "курсов" : "courses"}</span>
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setSemesterFilter("all");
                setProgramFilter("all");
              }}
            >
              {isRu ? "Сбросить фильтры" : "Clear filters"}
            </Button>
          )}
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <strong className="mt-3 block">
            {data.courses.length === 0
              ? isRu ? "Курсов пока нет" : "No courses yet"
              : isRu ? "По фильтрам ничего не найдено" : "No courses match the filters"}
          </strong>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            {data.courses.length === 0
              ? isRu
                ? "Самый быстрый старт — загрузить силлабус. Lamdan создаст проверяемый черновик курса и тем."
                : "The fastest start is importing a syllabus. Lamdan creates a reviewable course and topic draft."
              : isRu
                ? "Сбрось фильтры или измени запрос."
                : "Clear the filters or change the query."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {data.courses.length === 0 ? (
              <>
                <Link
                  to="/app/import-syllabus"
                  className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  <FileInput className="h-4 w-4 me-1" />
                  {isRu ? "Импортировать силлабус" : "Import syllabus"}
                </Link>
                <Button variant="outline" onClick={openCreate}>
                  <Plus className="h-4 w-4 me-1" />
                  {isRu ? "Создать вручную" : "Create manually"}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setSemesterFilter("all");
                  setProgramFilter("all");
                }}
              >
                {isRu ? "Сбросить фильтры" : "Clear filters"}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => {
            const program = data.programs.find((item) => item.id === course.programId);
            const materialCount = data.materials.filter((item) => item.courseId === course.id).length;
            const noteCount = data.notes.filter((item) => item.courseId === course.id).length;
            const cardCount = data.flashcards.filter((item) => item.courseId === course.id).length;
            const quizCount = data.quizzes.filter((item) => item.courseId === course.id).length;
            const topicCount = data.topics.filter((item) => item.courseId === course.id).length;
            return (
              <article key={course.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Link
                    to="/app/courses/$courseId"
                    params={{ courseId: course.id }}
                    className="min-w-0 flex-1"
                  >
                    <div className="text-xs font-mono text-muted-foreground">{course.number || "—"}</div>
                    <h2 className="mt-1 line-clamp-2 font-serif text-lg font-semibold hover:text-primary">
                      {course.title}
                    </h2>
                    {course.originalTitle && course.originalTitle !== course.title && (
                      <p dir="auto" className="mt-1 truncate text-xs text-muted-foreground">{course.originalTitle}</p>
                    )}
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" aria-label={isRu ? "Редактировать курс" : "Edit course"} onClick={() => openEdit(course.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={isRu ? "Удалить курс" : "Delete course"} onClick={() => deleteCourseSafely(course)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                  {course.semester && <span className="rounded border border-border px-2 py-1">{course.semester}</span>}
                  {course.credits != null && <span className="rounded border border-border px-2 py-1">{course.credits} {isRu ? "кред." : "credits"}</span>}
                  {course.instructor && <span className="max-w-full truncate rounded border border-border px-2 py-1">{course.instructor}</span>}
                  {program && <span className="max-w-full truncate rounded border border-border px-2 py-1">{program.name}</span>}
                </div>
                <div className="mt-4 grid grid-cols-5 gap-1 border-t border-border pt-3 text-center text-[10px] text-muted-foreground">
                  <ContentCount value={topicCount} label={isRu ? "тем" : "topics"} />
                  <ContentCount value={materialCount} label={isRu ? "источн." : "sources"} />
                  <ContentCount value={noteCount} label={isRu ? "консп." : "notes"} />
                  <ContentCount value={cardCount} label={isRu ? "карт." : "cards"} />
                  <ContentCount value={quizCount} label={isRu ? "тест." : "quizzes"} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CourseForm({ courseId, onDone }: { courseId?: string; onDone: () => void }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const existing = courseId ? data.courses.find((course) => course.id === courseId) : undefined;
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    originalTitle: existing?.originalTitle ?? "",
    number: existing?.number ?? "",
    semester: existing?.semester ?? "",
    credits: existing?.credits?.toString() ?? "",
    type: existing?.type ?? "",
    instructor: existing?.instructor ?? "",
    prerequisites: existing?.prerequisites ?? "",
    description: existing?.description ?? "",
    programId: existing?.programId ?? "_none",
  });

  const save = () => {
    const title = form.title.trim();
    if (!title) return;
    const parsedCredits = form.credits.trim() ? Number(form.credits.replace(",", ".")) : undefined;
    const payload = {
      title,
      originalTitle: form.originalTitle.trim() || undefined,
      number: form.number.trim() || undefined,
      semester: form.semester.trim() || undefined,
      credits: Number.isFinite(parsedCredits as number) ? parsedCredits : undefined,
      type: form.type.trim() || undefined,
      instructor: form.instructor.trim() || undefined,
      prerequisites: form.prerequisites.trim() || undefined,
      description: form.description.trim() || undefined,
      programId: form.programId === "_none" ? undefined : form.programId,
    };
    if (existing) {
      store.updateCourse(existing.id, payload);
      toast.success(isRu ? "Курс обновлён" : "Course updated");
    } else {
      store.createCourse({ ...payload, status: "not_started" });
      toast.success(isRu ? "Курс создан" : "Course created");
    }
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={isRu ? "Название" : "Title"}>
          <Input dir="auto" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </FormField>
        <FormField label={isRu ? "Оригинальное название" : "Original title"}>
          <Input dir="auto" value={form.originalTitle} onChange={(event) => setForm({ ...form, originalTitle: event.target.value })} />
        </FormField>
        <FormField label={isRu ? "Код курса" : "Course code"}>
          <Input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} />
        </FormField>
        <FormField label={isRu ? "Кредиты" : "Credits"}>
          <Input inputMode="decimal" value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} />
        </FormField>
        <FormField label={isRu ? "Семестр" : "Semester"}>
          <Input dir="auto" value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} />
        </FormField>
        <FormField label={isRu ? "Тип курса" : "Course type"}>
          <Input dir="auto" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} />
        </FormField>
        <FormField label={isRu ? "Преподаватель" : "Instructor"}>
          <Input dir="auto" value={form.instructor} onChange={(event) => setForm({ ...form, instructor: event.target.value })} />
        </FormField>
        <FormField label={isRu ? "Пререквизиты" : "Prerequisites"}>
          <Input dir="auto" value={form.prerequisites} onChange={(event) => setForm({ ...form, prerequisites: event.target.value })} />
        </FormField>
      </div>
      <FormField label={isRu ? "Программа" : "Program"}>
        <Select value={form.programId} onValueChange={(value) => setForm({ ...form, programId: value })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{isRu ? "Без программы" : "No program"}</SelectItem>
            {data.programs.map((program) => <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label={isRu ? "Описание" : "Description"}>
        <Textarea dir="auto" className="min-h-[130px] resize-y" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </FormField>
      <p className="text-xs text-muted-foreground">
        {isRu
          ? "Статусы прохождения и проценты здесь намеренно не используются: курс организует контент, а не оценивает твою продуктивность."
          : "Completion statuses and percentages are intentionally absent: a course organizes content rather than judging productivity."}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>{isRu ? "Отмена" : "Cancel"}</Button>
        <Button onClick={save} disabled={!form.title.trim()}>{isRu ? "Сохранить" : "Save"}</Button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ContentCount({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <strong className="block text-sm text-foreground">{value}</strong>
      {label}
    </span>
  );
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
