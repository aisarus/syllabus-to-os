import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckSquare2,
  FilePlus2,
  FileText,
  Layers3,
  Link2,
  Plus,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AIGenerateButton } from "@/components/ai-generate-dialog";
import { Button } from "@/components/ui/button";
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
import { DuplicateIntakeSkippedError, intakeFile } from "@/lib/material-intake";
import {
  getChunksByMaterial,
  store,
  useData,
  type Flashcard,
  type Material,
  type Note,
  type PresentationOutline,
  type Quiz,
  type Topic,
} from "@/lib/store";

export function CourseWorkspace({ courseId }: { courseId: string }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const course = data.courses.find((item) => item.id === courseId);
  const topics = useMemo(
    () =>
      data.topics
        .filter((topic) => topic.courseId === courseId)
        .slice()
        .sort((a, b) => a.order - b.order),
    [data.topics, courseId],
  );
  const materials = useMemo(
  () => data.materials.filter((material) => material.courseId === courseId),
  [data.materials, courseId],
);
  const notes = data.notes.filter((note) => note.courseId === courseId);
  const cards = data.flashcards.filter((card) => card.courseId === courseId);
  const quizzes = data.quizzes.filter((quiz) => quiz.courseId === courseId);
  const outlines = data.presentationOutlines.filter((outline) => outline.courseId === courseId);
  const availableMaterials = data.materials.filter((material) => !material.courseId);
  const [newTopic, setNewTopic] = useState("");
  const [attachMaterialId, setAttachMaterialId] = useState("");
  const [uploadTopicId, setUploadTopicId] = useState("_none");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [aiMaterialId, setAiMaterialId] = useState("");
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);

  useEffect(() => {
    if (materials.length === 0) {
      setAiMaterialId("");
      setSelectedChunkIds([]);
      return;
    }
    setAiMaterialId((current) =>
      current && materials.some((material) => material.id === current) ? current : materials[0].id,
    );
  }, [materials]);

  const aiMaterial = materials.find((material) => material.id === aiMaterialId);
  const aiChunks = aiMaterial ? getChunksByMaterial(data, aiMaterial.id) : [];

  useEffect(() => {
    setSelectedChunkIds(aiChunks.map((chunk) => chunk.id));
  }, [aiMaterialId, aiChunks.length]);

  if (!course) {
    return (
      <div className="mx-auto max-w-6xl">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/courses" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {isRu ? "К курсам" : "Back to courses"}
        </Button>
        <div className="mt-4 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {isRu ? "Курс удалён или не найден" : "The course was deleted or could not be found"}
        </div>
      </div>
    );
  }

  const topicMaterials = new Map(
    topics.map((topic) => [
      topic.id,
      materials.filter((material) => material.topicId === topic.id),
    ]),
  );
  const unassignedMaterials = materials.filter(
    (material) => !material.topicId || !topics.some((topic) => topic.id === material.topicId),
  );
  const uncoveredTopics = topics.filter(
    (topic) => (topicMaterials.get(topic.id)?.length ?? 0) === 0,
  );
  const selectedChunkCount = selectedChunkIds.filter((id) =>
    aiChunks.some((chunk) => chunk.id === id),
  ).length;
  const selectedCharacters = aiChunks
    .filter((chunk) => selectedChunkIds.includes(chunk.id))
    .reduce((sum, chunk) => sum + chunk.text.length, 0);

  const addTopic = () => {
    const title = newTopic.trim();
    if (!title) return;
    store.createTopic({ courseId, title, status: "not_started" });
    setNewTopic("");
  };

  const attachExistingMaterial = () => {
    if (!attachMaterialId) return;
    store.updateMaterial(attachMaterialId, { courseId, topicId: undefined });
    setAttachMaterialId("");
    toast.success(isRu ? "Материал добавлен в курс" : "Material added to course");
  };

  const uploadMaterial = async (file: File) => {
    setUploadBusy(true);
    try {
      const result = await intakeFile(file, {
        courseId,
        topicId: uploadTopicId === "_none" ? undefined : uploadTopicId,
      });
      if (result.ok) {
        toast.success(isRu ? "Материал загружен в курс" : "Material uploaded to course");
      } else {
        toast.warning(
          result.message ||
            (isRu ? "Материал сохранён с предупреждением" : "Material saved with a warning"),
        );
      }
    } catch (error) {
      if (error instanceof DuplicateIntakeSkippedError) {
        toast.message(isRu ? "Дубликат пропущен" : "Duplicate skipped");
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px]">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/courses" })}>
        <ArrowLeft className="h-4 w-4 me-1" />
        {isRu ? "К курсам" : "Back to courses"}
      </Button>

      <header className="mt-3 border-b border-border pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <Input
              value={course.title}
              aria-label={isRu ? "Название курса" : "Course title"}
              onChange={(event) => store.updateCourse(course.id, { title: event.target.value })}
              className="h-auto border-transparent bg-transparent p-0 font-serif text-3xl font-semibold leading-tight hover:border-input focus:border-input md:text-4xl"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {course.number && (
                <span className="rounded border border-border bg-surface px-2 py-1 font-mono">
                  {course.number}
                </span>
              )}
              {course.semester && <span>{course.semester}</span>}
              {course.credits != null && (
                <span>
                  {course.credits} {isRu ? "кредитов" : "credits"}
                </span>
              )}
              {course.instructor && <span>{course.instructor}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/app/import-syllabus"
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-accent"
            >
              <BookOpen className="h-4 w-4 me-1" />
              {isRu ? "Импортировать силлабус" : "Import syllabus"}
            </Link>
            <Button
              variant="destructive"
              onClick={() => {
                const confirmed = confirm(
                  isRu
                    ? "Удалить курс и его темы? Материалы и результаты останутся, но потеряют привязку."
                    : "Delete the course and its topics? Materials and outputs remain but lose the course link.",
                );
                if (!confirmed) return;
                for (const material of materials)
                  store.updateMaterial(material.id, { courseId: undefined, topicId: undefined });
                for (const note of notes)
                  store.updateNote(note.id, { courseId: undefined, topicId: undefined });
                for (const card of cards)
                  store.updateCard(card.id, { courseId: undefined, topicId: undefined });
                for (const quiz of quizzes)
                  store.updateQuiz(quiz.id, { courseId: undefined, topicId: undefined });
                for (const outline of outlines)
                  store.updateOutline(outline.id, { courseId: undefined, topicId: undefined });
                store.deleteCourse(course.id);
                navigate({ to: "/app/courses" });
              }}
            >
              <Trash2 className="h-4 w-4 me-1" />
              {isRu ? "Удалить курс" : "Delete course"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-5">
          <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold">
                  {isRu ? "Структура курса" : "Course structure"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isRu
                    ? "Темы силлабуса и реальные источники — без процентов, таймеров и искусственного прогресса."
                    : "Syllabus topics and real sources without percentages, timers, or artificial progress."}
                </p>
              </div>
              <span className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                {topics.length} {isRu ? "тем" : "topics"}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                value={newTopic}
                aria-label={isRu ? "Название новой темы" : "New topic title"}
                onChange={(event) => setNewTopic(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addTopic();
                }}
                placeholder={isRu ? "Добавить тему или неделю" : "Add a topic or week"}
              />
              <Button onClick={addTopic} disabled={!newTopic.trim()}>
                <Plus className="h-4 w-4 me-1" />
                {isRu ? "Добавить" : "Add"}
              </Button>
            </div>

            {uncoveredTopics.length > 0 && (
              <div className="mt-4 rounded-md border border-yellow-500/25 bg-yellow-500/5 p-3 text-xs">
                <strong className="text-yellow-200">
                  {isRu ? "Темы без материалов" : "Topics without source material"}
                </strong>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {uncoveredTopics.map((topic) => (
                    <span
                      key={topic.id}
                      className="rounded border border-yellow-500/20 px-2 py-1 text-muted-foreground"
                    >
                      {topic.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {topics.length === 0 ? (
                <EmptyState
                  title={isRu ? "Тем пока нет" : "No topics yet"}
                  text={
                    isRu
                      ? "Импортируй силлабус или добавь первую тему вручную."
                      : "Import a syllabus or add the first topic manually."
                  }
                />
              ) : (
                topics.map((topic, index) => (
                  <TopicGroup
                    key={topic.id}
                    topic={topic}
                    index={index}
                    materials={topicMaterials.get(topic.id) ?? []}
                    allTopics={topics}
                  />
                ))
              )}
            </div>

            {unassignedMaterials.length > 0 && (
              <div className="mt-5 rounded-lg border border-dashed border-border p-3">
                <h3 className="text-sm font-semibold">
                  {isRu ? "Материалы без темы" : "Materials without a topic"}
                </h3>
                <div className="mt-2 space-y-2">
                  {unassignedMaterials.map((material) => (
                    <MaterialRow key={material.id} material={material} topics={topics} />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
            <h2 className="font-serif text-xl font-semibold">
              {isRu ? "Учебные результаты" : "Study outputs"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRu
                ? "Конспекты, карточки, тесты и планы презентаций, связанные с этим курсом."
                : "Notes, flashcards, quizzes, and presentation outlines linked to this course."}
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <OutputSection
                title={isRu ? "Конспекты" : "Notes"}
                icon={FileText}
                empty={notes.length === 0}
              >
                {notes.map((note) => (
                  <NoteRow key={note.id} note={note} topics={topics} />
                ))}
              </OutputSection>
              <OutputSection
                title={isRu ? "Тесты" : "Quizzes"}
                icon={BookOpen}
                empty={quizzes.length === 0}
              >
                {quizzes.map((quiz) => (
                  <QuizRow key={quiz.id} quiz={quiz} topics={topics} />
                ))}
              </OutputSection>
              <OutputSection
                title={isRu ? "Карточки" : "Flashcards"}
                icon={Layers3}
                empty={cards.length === 0}
              >
                {cards.slice(0, 24).map((card) => (
                  <CardRow key={card.id} card={card} topics={topics} />
                ))}
                {cards.length > 24 && (
                  <Link to="/app/flashcards" className="text-xs text-primary hover:underline">
                    {isRu
                      ? `Открыть остальные ${cards.length - 24}`
                      : `Open remaining ${cards.length - 24}`}
                  </Link>
                )}
              </OutputSection>
              <OutputSection
                title={isRu ? "Планы презентаций" : "Presentation outlines"}
                icon={FileText}
                empty={outlines.length === 0}
              >
                {outlines.map((outline) => (
                  <OutlineRow key={outline.id} outline={outline} topics={topics} />
                ))}
              </OutputSection>
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">{isRu ? "Добавить материал" : "Add material"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRu
                ? "Загрузи новый источник сразу в курс или прикрепи материал из общей библиотеки."
                : "Upload a new source directly to the course or attach one from the library."}
            </p>
            <div className="mt-3 space-y-3">
              <Select value={uploadTopicId} onValueChange={setUploadTopicId}>
                <SelectTrigger
                  aria-label={isRu ? "Тема для загружаемого материала" : "Topic for uploaded material"}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{isRu ? "Без темы" : "No topic"}</SelectItem>
                  {topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void (async () => {
                    for (const file of files) await uploadMaterial(file);
                  })();
                }}
              />
              <Button
                className="w-full"
                onClick={() => fileRef.current?.click()}
                disabled={uploadBusy}
              >
                <Upload className="h-4 w-4 me-1" />
                {uploadBusy
                  ? isRu
                    ? "Обрабатываю…"
                    : "Processing…"
                  : isRu
                    ? "Загрузить файлы"
                    : "Upload files"}
              </Button>

              {availableMaterials.length > 0 && (
                <div className="border-t border-border pt-3">
                  <Label>{isRu ? "Из общей библиотеки" : "From library"}</Label>
                  <Select value={attachMaterialId} onValueChange={setAttachMaterialId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={isRu ? "Выбрать материал" : "Choose material"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMaterials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={attachExistingMaterial}
                    disabled={!attachMaterialId}
                  >
                    <Link2 className="h-4 w-4 me-1" />
                    {isRu ? "Прикрепить к курсу" : "Attach to course"}
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">
              {isRu ? "AI по выбранному источнику" : "AI from selected source"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isRu
                ? "Lamdan ничего не включает молча: сначала выбери материал и конкретные фрагменты."
                : "Lamdan includes nothing silently: choose one material and its exact chunks first."}
            </p>
            {materials.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {isRu
                  ? "Сначала добавь материал в курс."
                  : "Add source material to the course first."}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <Select value={aiMaterialId} onValueChange={setAiMaterialId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedChunkIds(aiChunks.map((chunk) => chunk.id))}
                  >
                    <CheckSquare2 className="h-3.5 w-3.5 me-1" />
                    {isRu ? "Все" : "All"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedChunkIds([])}>
                    <Square className="h-3.5 w-3.5 me-1" />
                    {isRu ? "Снять" : "None"}
                  </Button>
                </div>
                <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-border bg-background p-1">
                  {aiChunks.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      {isRu
                        ? "У материала нет извлечённых фрагментов."
                        : "This material has no extracted chunks."}
                    </p>
                  ) : (
                    aiChunks.map((chunk) => {
                      const selected = selectedChunkIds.includes(chunk.id);
                      return (
                        <button
                          key={chunk.id}
                          type="button"
                          className={`w-full rounded p-2 text-start text-xs ${selected ? "border border-primary/40 bg-primary/10" : "hover:bg-accent"}`}
                          onClick={() =>
                            setSelectedChunkIds((current) =>
                              current.includes(chunk.id)
                                ? current.filter((id) => id !== chunk.id)
                                : [...current, chunk.id],
                            )
                          }
                        >
                          <strong dir="auto" className="block truncate">
                            {chunk.title || `${isRu ? "Фрагмент" : "Chunk"} ${chunk.order + 1}`}
                          </strong>
                          <span dir="auto" className="mt-1 block line-clamp-2 text-muted-foreground">
                            {chunk.text}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selectedChunkCount} {isRu ? "фрагментов" : "chunks"} ·{" "}
                  {selectedCharacters.toLocaleString()} {isRu ? "знаков" : "characters"}
                </p>
                {aiMaterial && selectedChunkCount > 0 ? (
                  <div className="grid gap-2">
                    <AIGenerateButton
                      kind="note"
                      initialMaterialId={aiMaterial.id}
                      initialCourseId={course.id}
                      initialTopicId={aiMaterial.topicId}
                      initialChunkIds={selectedChunkIds}
                      label={isRu ? "Создать конспект" : "Create note"}
                    />
                    <AIGenerateButton
                      kind="flashcards"
                      initialMaterialId={aiMaterial.id}
                      initialCourseId={course.id}
                      initialTopicId={aiMaterial.topicId}
                      initialChunkIds={selectedChunkIds}
                      label={isRu ? "Создать карточки" : "Create flashcards"}
                    />
                    <AIGenerateButton
                      kind="quiz"
                      initialMaterialId={aiMaterial.id}
                      initialCourseId={course.id}
                      initialTopicId={aiMaterial.topicId}
                      initialChunkIds={selectedChunkIds}
                      label={isRu ? "Создать тест" : "Create quiz"}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-yellow-200">
                    {isRu ? "Выбери хотя бы один фрагмент." : "Select at least one chunk."}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">{isRu ? "Метаданные курса" : "Course metadata"}</h2>
            <div className="mt-3 space-y-3">
              <MetadataInput
                label={isRu ? "Код" : "Code"}
                value={course.number ?? ""}
                onChange={(value) => store.updateCourse(course.id, { number: value || undefined })}
              />
              <MetadataInput
                label={isRu ? "Преподаватель" : "Instructor"}
                value={course.instructor ?? ""}
                onChange={(value) =>
                  store.updateCourse(course.id, { instructor: value || undefined })
                }
              />
              <MetadataInput
                label={isRu ? "Семестр" : "Semester"}
                value={course.semester ?? ""}
                onChange={(value) =>
                  store.updateCourse(course.id, { semester: value || undefined })
                }
              />
              <MetadataInput
                label={isRu ? "Кредиты" : "Credits"}
                value={course.credits?.toString() ?? ""}
                onChange={(value) => {
                  const parsed = value.trim() === "" ? undefined : Number(value.replace(",", "."));
                  store.updateCourse(course.id, {
                    credits: Number.isFinite(parsed as number) ? parsed : undefined,
                  });
                }}
              />
              <MetadataInput
                label={isRu ? "Тип" : "Type"}
                value={course.type ?? ""}
                onChange={(value) => store.updateCourse(course.id, { type: value || undefined })}
              />
              <MetadataInput
                label={isRu ? "Пререквизиты" : "Prerequisites"}
                value={course.prerequisites ?? ""}
                onChange={(value) =>
                  store.updateCourse(course.id, { prerequisites: value || undefined })
                }
              />
              <div>
                <Label>{isRu ? "Описание" : "Description"}</Label>
                <Textarea
                  dir="auto"
                  className="mt-1 min-h-[140px] resize-y"
                  value={course.description ?? ""}
                  onChange={(event) =>
                    store.updateCourse(course.id, { description: event.target.value || undefined })
                  }
                />
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function TopicGroup({
  topic,
  index,
  materials,
  allTopics,
}: {
  topic: Topic;
  index: number;
  materials: Material[];
  allTopics: Topic[];
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded border border-border text-xs text-muted-foreground">
          {index + 1}
        </span>
        <Input
          dir="auto"
          className="flex-1 border-transparent bg-transparent font-medium hover:border-input focus:border-input"
          value={topic.title}
          onChange={(event) => store.updateTopic(topic.id, { title: event.target.value })}
        />
        <span
          className={`rounded px-2 py-1 text-[10px] ${materials.length ? "bg-emerald-500/10 text-emerald-300" : "bg-yellow-500/10 text-yellow-200"}`}
        >
          {materials.length
            ? `${materials.length} ${isRu ? "источн." : "sources"}`
            : isRu
              ? "Нет материалов"
              : "Uncovered"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label={isRu ? "Удалить тему" : "Delete topic"}
          onClick={() => {
            const confirmed = confirm(
              isRu
                ? "Удалить тему? Материалы и результаты останутся в курсе без темы."
                : "Delete this topic? Materials and outputs remain in the course without a topic.",
            );
            if (!confirmed) return;
            for (const material of materials)
              store.updateMaterial(material.id, { topicId: undefined });
            store.deleteTopic(topic.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {materials.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {materials.map((material) => (
            <MaterialRow key={material.id} material={material} topics={allTopics} />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialRow({ material, topics }: { material: Material; topics: Topic[] }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center">
      <Link
        to="/app/materials/$materialId"
        params={{ materialId: material.id }}
        className="min-w-0 flex-1"
      >
        <strong dir="auto" className="block truncate text-sm hover:text-primary">
          {material.title}
        </strong>
        <span className="text-[10px] uppercase text-muted-foreground">
          {material.type} · {material.processingStatus}
        </span>
      </Link>
      <Select
        value={material.topicId ?? "_none"}
        onValueChange={(value) =>
          store.updateMaterial(material.id, { topicId: value === "_none" ? undefined : value })
        }
      >
        <SelectTrigger className="h-8 w-full text-xs sm:w-[190px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">{isRu ? "Без темы" : "No topic"}</SelectItem>
          {topics.map((topic) => (
            <SelectItem key={topic.id} value={topic.id}>
              {topic.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="icon"
        variant="ghost"
        aria-label={isRu ? "Убрать из курса" : "Remove from course"}
        onClick={() =>
          store.updateMaterial(material.id, { courseId: undefined, topicId: undefined })
        }
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function OutputSection({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: typeof FileText;
  empty: boolean;
  children: React.ReactNode;
}) {
  const { lang } = useApp();
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {empty ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {lang === "ru" ? "Пока пусто" : "Nothing here yet"}
        </p>
      ) : (
        <div className="mt-3 space-y-2">{children}</div>
      )}
    </div>
  );
}

function NoteRow({ note, topics }: { note: Note; topics: Topic[] }) {
  return (
    <OutputRow
      title={note.title}
      to="/app/notes/$noteId"
      params={{ noteId: note.id }}
      topicId={note.topicId}
      topics={topics}
      onTopicChange={(topicId) => store.updateNote(note.id, { topicId })}
    />
  );
}

function QuizRow({ quiz, topics }: { quiz: Quiz; topics: Topic[] }) {
  return (
    <OutputRow
      title={quiz.title}
      to="/app/quizzes/$quizId"
      params={{ quizId: quiz.id }}
      topicId={quiz.topicId}
      topics={topics}
      onTopicChange={(topicId) => store.updateQuiz(quiz.id, { topicId })}
    />
  );
}

function CardRow({ card, topics }: { card: Flashcard; topics: Topic[] }) {
  return (
    <OutputRow
      title={card.front}
      to="/app/flashcards"
      topicId={card.topicId}
      topics={topics}
      onTopicChange={(topicId) => store.updateCard(card.id, { topicId })}
    />
  );
}

function OutlineRow({ outline, topics }: { outline: PresentationOutline; topics: Topic[] }) {
  return (
    <OutputRow
      title={outline.title}
      to="/app/presentations/$outlineId"
      params={{ outlineId: outline.id }}
      topicId={outline.topicId}
      topics={topics}
      onTopicChange={(topicId) => store.updateOutline(outline.id, { topicId })}
    />
  );
}

function OutputRow({
  title,
  to,
  params,
  topicId,
  topics,
  onTopicChange,
}: {
  title: string;
  to: string;
  params?: Record<string, string>;
  topicId?: string;
  topics: Topic[];
  onTopicChange: (topicId: string | undefined) => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  return (
    <div className="flex flex-col gap-2 rounded border border-border p-2 sm:flex-row sm:items-center">
      <Link
        to={to as never}
        params={params as never}
        className="min-w-0 flex-1 truncate text-sm hover:text-primary"
      >
        {title || "—"}
      </Link>
      <Select
        value={topicId ?? "_none"}
        onValueChange={(value) => onTopicChange(value === "_none" ? undefined : value)}
      >
        <SelectTrigger className="h-8 w-full text-xs sm:w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">{isRu ? "Без темы" : "No topic"}</SelectItem>
          {topics.map((topic) => (
            <SelectItem key={topic.id} value={topic.id}>
              {topic.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MetadataInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        dir="auto"
        className="mt-1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <FilePlus2 className="mx-auto h-7 w-7 text-muted-foreground" />
      <strong className="mt-3 block text-sm">{title}</strong>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
