import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FileUp,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { checkAIStatus, parseSyllabusWithAI } from "@/lib/ai";
import {
  findDuplicateCourse,
  ingestPastedSyllabus,
  ingestSyllabusFile,
  mergeAISyllabusDraft,
  normalizeReviewCourse,
  previousImportMatches,
  syllabusDetailsMarkdown,
  type DuplicateCourseMatch,
  type ReviewCourseDraft,
  type ReviewSyllabusDraft,
  type SyllabusFieldKey,
  type SyllabusSourceDocument,
} from "@/lib/syllabus-review";
import { normalizedTitle } from "@/lib/syllabus-parser";
import { store, useData, type Course } from "@/lib/store";

interface CourseDecision {
  action: "create" | "update" | "skip";
  match?: DuplicateCourseMatch;
}

const ACCEPTED = ".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function SyllabusReviewWorkspace() {
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<SyllabusSourceDocument | null>(null);
  const [draft, setDraft] = useState<ReviewSyllabusDraft | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, CourseDecision>>({});
  const [programChoice, setProgramChoice] = useState("_none");
  const [newProgramName, setNewProgramName] = useState("");
  const [newInstitution, setNewInstitution] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const initialize = (nextSource: SyllabusSourceDocument, nextDraft: ReviewSyllabusDraft) => {
    setSource(nextSource);
    setDraft(nextDraft);
    setNewProgramName(nextDraft.programName ?? "");
    setNewInstitution(nextDraft.institution ?? "");
    setProgramChoice(nextDraft.programName ? "_new" : "_none");
    setDecisions(
      Object.fromEntries(
        nextDraft.courses.map((course) => {
          const match = findDuplicateCourse(data, course);
          return [
            course.id,
            match ? { action: "update" as const, match } : { action: "create" as const },
          ];
        }),
      ),
    );
  };

  const loadFile = async (file: File) => {
    setBusy(true);
    try {
      const result = await ingestSyllabusFile(file);
      initialize(result.source, result.draft);
      if (result.source.extraction.status === "partial" || result.source.extraction.status === "no_text") {
        toast.warning(result.source.extraction.message || (isRu ? "Текст извлечён частично" : "Text was extracted partially"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const loadPaste = () => {
    if (!pastedText.trim()) {
      toast.error(isRu ? "Вставь текст силлабуса" : "Paste syllabus text first");
      return;
    }
    const result = ingestPastedSyllabus(pastedText);
    initialize(result.source, result.draft);
  };

  const improveWithAI = async () => {
    if (!source || !draft) return;
    setAiBusy(true);
    try {
      const status = await checkAIStatus(true);
      if (!status.configured) {
        toast.error(isRu ? "AI не подключён" : "AI is not configured");
        return;
      }
      const result = await parseSyllabusWithAI({
        fileName: source.fileName,
        sheets: source.sheets,
        deterministicDraft: draft,
        ignoredRows: draft.ignoredRows,
        locale: lang,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const merged = mergeAISyllabusDraft(result.data, draft);
      setDraft(merged);
      setDecisions((current) =>
        Object.fromEntries(
          merged.courses.map((course) => {
            const existing = current[course.id];
            const match = findDuplicateCourse(data, course);
            return [
              course.id,
              existing ?? (match ? { action: "update" as const, match } : { action: "create" as const }),
            ];
          }),
        ),
      );
      toast.success(isRu ? "AI-черновик готов к проверке" : "AI draft is ready for review");
    } finally {
      setAiBusy(false);
    }
  };

  const reset = () => {
    setSource(null);
    setDraft(null);
    setDecisions({});
    setPastedText("");
    setProgramChoice("_none");
    setNewProgramName("");
    setNewInstitution("");
  };

  const selectedCourses = draft?.courses.filter(
    (course) => course.include && decisions[course.id]?.action !== "skip",
  ) ?? [];
  const previousImports = source ? previousImportMatches(data, source.fileName) : 0;
  const lowConfidenceCount = selectedCourses.filter((course) => course.confidence < 0.6).length;
  const duplicateCount = Object.values(decisions).filter((decision) => decision.match).length;

  const apply = () => {
    if (!draft || !source) return;
    if (selectedCourses.length === 0) {
      toast.error(isRu ? "Нет курсов для импорта" : "No courses selected for import");
      return;
    }

    let programId: string | undefined;
    let programName: string | undefined;
    if (programChoice === "_new") {
      if (!newProgramName.trim()) {
        toast.error(isRu ? "Укажи название программы" : "Enter a program name");
        return;
      }
      const program = store.createProgram({
        name: newProgramName.trim(),
        institution: newInstitution.trim(),
        degree: draft.degree ?? "",
        years: 1,
        semesters: draft.semesters.map((semester) => semester.title),
      });
      programId = program.id;
      programName = program.name;
    } else if (programChoice !== "_none") {
      programId = programChoice;
      programName = data.programs.find((program) => program.id === programChoice)?.name;
    }

    const affectedCourses: Course[] = [];
    const affectedTopicIds: string[] = [];

    for (const reviewed of selectedCourses) {
      const decision = decisions[reviewed.id] ?? { action: "create" as const };
      let course: Course;

      if (decision.action === "update" && decision.match) {
        course = decision.match.course;
        store.updateCourse(course.id, {
          programId: programId ?? course.programId,
          title: reviewed.title.trim(),
          originalTitle: reviewed.originalTitle,
          number: reviewed.number,
          semester: reviewed.semester,
          credits: reviewed.credits,
          instructor: reviewed.instructor,
          type: reviewed.type,
          prerequisites: reviewed.prerequisites,
          description: reviewed.description,
        });
        course = { ...course, ...reviewed, programId: programId ?? course.programId } as Course;
      } else {
        course = store.createCourse({
          programId,
          title: reviewed.title.trim(),
          originalTitle: reviewed.originalTitle,
          number: reviewed.number,
          semester: reviewed.semester,
          credits: reviewed.credits,
          instructor: reviewed.instructor,
          type: reviewed.type,
          prerequisites: reviewed.prerequisites,
          description: reviewed.description,
          status: "not_started",
        });
      }
      affectedCourses.push(course);

      const existingTopics = data.topics.filter((topic) => topic.courseId === course.id);
      const topicByTitle = new Map(existingTopics.map((topic) => [normalizedTitle(topic.title), topic]));
      reviewed.topics.forEach((title, index) => {
        const key = normalizedTitle(title);
        const existing = topicByTitle.get(key);
        if (existing) {
          affectedTopicIds.push(existing.id);
          return;
        }
        const created = store.createTopic({
          courseId: course.id,
          title,
          status: "not_started",
          order: existingTopics.length + index,
        });
        affectedTopicIds.push(created.id);
        topicByTitle.set(key, created);
      });

      const existingSyllabus = data.materials.find(
        (material) =>
          material.courseId === course.id &&
          material.type === "syllabus" &&
          (material.fileName?.toLowerCase() === source.fileName.toLowerCase() ||
            (material.rawText && material.rawText === source.rawText)),
      );
      const material = existingSyllabus
        ? existingSyllabus
        : store.createMaterial({
            title: source.fileName.replace(/\.[^.]+$/, "") || reviewed.title,
            type: "syllabus",
            sourceMode: source.sourceType === "text" ? "paste" : "upload",
            fileName: source.fileName,
            courseId: course.id,
            tags: ["syllabus"],
            rawText: source.rawText,
            processingStatus: source.extraction.status,
            processingMessage: source.extraction.message,
            pageCount: source.extraction.pageCount,
            wordCount: source.extraction.wordCount,
            charCount: source.extraction.charCount,
            extractionMethod: source.extraction.extractionMethod,
            sourceLanguage: source.extraction.sourceLanguage,
          });

      if (existingSyllabus) {
        store.updateMaterial(existingSyllabus.id, {
          title: source.fileName.replace(/\.[^.]+$/, "") || reviewed.title,
          rawText: source.rawText,
          processingStatus: source.extraction.status,
          processingMessage: source.extraction.message,
          pageCount: source.extraction.pageCount,
          wordCount: source.extraction.wordCount,
          charCount: source.extraction.charCount,
          extractionMethod: source.extraction.extractionMethod,
          sourceLanguage: source.extraction.sourceLanguage,
        });
      }
      store.replaceMaterialChunksForMaterial(material.id, source.chunks);

      const details = syllabusDetailsMarkdown(reviewed);
      const existingNote = data.notes.find(
        (note) => note.courseId === course.id && note.tags.includes("syllabus-review"),
      );
      if (existingNote) {
        store.updateNote(existingNote.id, {
          title: `${reviewed.title} — syllabus`,
          content: details,
          materialId: material.id,
        });
      } else {
        store.createNote({
          title: `${reviewed.title} — syllabus`,
          content: details,
          tags: ["syllabus-review"],
          courseId: course.id,
          materialId: material.id,
          sourceChunkIds: [],
        });
      }
    }

    store.recordSyllabusImport({
      source: source.sourceType as never,
      fileName: source.fileName,
      sheetName: draft.detectedSheetName,
      programId,
      programName,
      courseIds: affectedCourses.map((course) => course.id),
      topicIds: Array.from(new Set(affectedTopicIds)),
    });

    setConfirmOpen(false);
    toast.success(
      isRu
        ? `Силлабус применён: ${affectedCourses.length} курс(а)`
        : `Syllabus applied: ${affectedCourses.length} course(s)`,
    );
    reset();
  };

  return (
    <div className="space-y-6">
      {!draft || !source ? (
        <section className="rounded-xl border border-border bg-surface p-4 md:p-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={inputMode === "file" ? "default" : "outline"}
              onClick={() => setInputMode("file")}
            >
              <FileUp className="h-4 w-4 me-1" />
              {isRu ? "Файл" : "File"}
            </Button>
            <Button
              variant={inputMode === "paste" ? "default" : "outline"}
              onClick={() => setInputMode("paste")}
            >
              <FileText className="h-4 w-4 me-1" />
              {isRu ? "Вставить текст" : "Paste text"}
            </Button>
          </div>

          {inputMode === "file" ? (
            <div
              className="mt-4 rounded-lg border-2 border-dashed border-border p-10 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void loadFile(file);
              }}
            >
              <FileUp className="mx-auto h-9 w-9 text-muted-foreground" />
              <h2 className="mt-3 font-serif text-xl font-semibold">
                {isRu ? "Загрузи силлабус" : "Upload a syllabus"}
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
                {isRu
                  ? "PDF, DOCX, XLSX, CSV или обычный текст. Lamdan сначала извлечёт данные и покажет экран проверки — в курсы ничего не попадёт автоматически."
                  : "PDF, DOCX, XLSX, CSV or plain text. Lamdan extracts a review draft first and changes no course data automatically."}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void loadFile(file);
                  event.target.value = "";
                }}
              />
              <Button className="mt-5" onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? <RefreshCw className="h-4 w-4 me-1 animate-spin" /> : <FileUp className="h-4 w-4 me-1" />}
                {busy ? (isRu ? "Извлекаю…" : "Extracting…") : isRu ? "Выбрать файл" : "Choose file"}
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <Textarea
                dir="auto"
                className="min-h-[300px] resize-y"
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                placeholder={isRu ? "Вставь сюда полный текст силлабуса…" : "Paste the full syllabus text here…"}
              />
              <div className="flex justify-end">
                <Button onClick={loadPaste}>
                  <CheckCircle2 className="h-4 w-4 me-1" />
                  {isRu ? "Создать черновик проверки" : "Create review draft"}
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary/10 px-2 py-1 text-xs uppercase text-primary">
                    {source.sourceType}
                  </span>
                  <strong>{source.fileName}</strong>
                  <span className="text-xs text-muted-foreground">
                    {source.extraction.wordCount.toLocaleString()} {isRu ? "слов" : "words"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isRu
                    ? "Это только черновик. Исправь поля, темы и условия курса, затем явно подтверди применение."
                    : "This is only a draft. Correct fields, topics and requirements, then explicitly confirm applying it."}
                </p>
                {previousImports > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {isRu
                      ? `Файл с таким именем уже импортировался ${previousImports} раз(а). Для совпавших курсов по умолчанию выбран безопасный update.`
                      : `A file with this name was imported ${previousImports} time(s). Matching courses default to a safe update.`}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={improveWithAI} disabled={aiBusy}>
                  {aiBusy ? <RefreshCw className="h-4 w-4 me-1 animate-spin" /> : <Sparkles className="h-4 w-4 me-1" />}
                  {isRu ? "Улучшить через AI" : "Improve with AI"}
                </Button>
                <Button variant="ghost" onClick={reset}>
                  <X className="h-4 w-4 me-1" />
                  {isRu ? "Отменить импорт" : "Cancel import"}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <SummaryCell label={isRu ? "Курсов" : "Courses"} value={draft.courses.length} />
              <SummaryCell label={isRu ? "Тем" : "Topics"} value={draft.courses.reduce((sum, course) => sum + course.topics.length, 0)} />
              <SummaryCell label={isRu ? "Совпадений" : "Matches"} value={duplicateCount} />
              <SummaryCell label={isRu ? "Низкая уверенность" : "Low confidence"} value={lowConfidenceCount} />
            </div>
          </section>

          <section className="space-y-4">
            {draft.courses.map((course, index) => (
              <CourseReviewCard
                key={course.id}
                course={course}
                index={index}
                decision={decisions[course.id] ?? { action: "create" }}
                onDecision={(decision) => setDecisions((current) => ({ ...current, [course.id]: decision }))}
                onChange={(next) =>
                  setDraft({
                    ...draft,
                    courses: draft.courses.map((item) => (item.id === course.id ? next : item)),
                  })
                }
                onDelete={() =>
                  setDraft({ ...draft, courses: draft.courses.filter((item) => item.id !== course.id) })
                }
              />
            ))}
            <Button
              variant="outline"
              onClick={() => {
                const id = `manual_${Date.now().toString(36)}`;
                const course = normalizeReviewCourse({
                  id,
                  include: true,
                  title: "",
                  topics: [],
                  readings: [],
                  assignments: [],
                  exams: [],
                  grading: [],
                  confidence: 1,
                  fieldConfidence: {},
                  warnings: [],
                  source: { sheetName: "Manual", rowIndex: 0, originalCells: [] },
                });
                setDraft({ ...draft, courses: [...draft.courses, course] });
                setDecisions((current) => ({ ...current, [id]: { action: "create" } }));
              }}
            >
              <Plus className="h-4 w-4 me-1" />
              {isRu ? "Добавить курс вручную" : "Add course manually"}
            </Button>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
            <h2 className="font-serif text-xl font-semibold">
              {isRu ? "Куда применить" : "Apply destination"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRu
                ? "Программа необязательна. Можно оставить курс самостоятельным, выбрать существующую программу или создать новую."
                : "A program is optional. Keep the course standalone, use an existing program, or create a new one."}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,260px)_1fr_1fr]">
              <Select value={programChoice} onValueChange={setProgramChoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{isRu ? "Без программы" : "No program"}</SelectItem>
                  <SelectItem value="_new">{isRu ? "Создать программу" : "Create program"}</SelectItem>
                  {data.programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {programChoice === "_new" && (
                <>
                  <Input value={newProgramName} onChange={(event) => setNewProgramName(event.target.value)} placeholder={isRu ? "Название программы" : "Program name"} />
                  <Input value={newInstitution} onChange={(event) => setNewInstitution(event.target.value)} placeholder={isRu ? "Учебное заведение" : "Institution"} />
                </>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setConfirmOpen(true)} disabled={selectedCourses.length === 0}>
                <CheckCircle2 className="h-4 w-4 me-1" />
                {isRu ? "Проверить и применить" : "Review and apply"}
              </Button>
            </div>
          </section>
        </>
      )}

      <ImportHistory />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isRu ? "Подтвердить импорт силлабуса" : "Confirm syllabus import"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              {isRu
                ? "Только после этой кнопки Lamdan изменит данные. Курсы с совпадением будут обновлены, темы объединятся без удаления существующих, а источник сохранится как материал и проверенный конспект."
                : "Only this button changes data. Matching courses are updated, topics merge without deleting existing ones, and the source is saved as a material plus a reviewed note."}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCell label={isRu ? "Применить" : "Apply"} value={selectedCourses.length} />
              <SummaryCell label={isRu ? "Обновить" : "Update"} value={selectedCourses.filter((course) => decisions[course.id]?.action === "update").length} />
              <SummaryCell label={isRu ? "Создать" : "Create"} value={selectedCourses.filter((course) => decisions[course.id]?.action === "create").length} />
              <SummaryCell label={isRu ? "Тем" : "Topics"} value={selectedCourses.reduce((sum, course) => sum + course.topics.length, 0)} />
            </div>
            {lowConfidenceCount > 0 && (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-100">
                {isRu
                  ? `${lowConfidenceCount} курс(а) имеют низкую общую уверенность. Проверь пустые поля перед подтверждением.`
                  : `${lowConfidenceCount} course(s) have low overall confidence. Review empty fields before confirming.`}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {isRu ? "Назад" : "Back"}
            </Button>
            <Button onClick={apply}>
              <CheckCircle2 className="h-4 w-4 me-1" />
              {isRu ? "Применить изменения" : "Apply changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseReviewCard({
  course,
  index,
  decision,
  onDecision,
  onChange,
  onDelete,
}: {
  course: ReviewCourseDraft;
  index: number;
  decision: CourseDecision;
  onDecision: (decision: CourseDecision) => void;
  onChange: (course: ReviewCourseDraft) => void;
  onDelete: () => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const update = (patch: Partial<ReviewCourseDraft>) => onChange(normalizeReviewCourse({ ...course, ...patch }));

  return (
    <article className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-semibold">
              {course.title || `${isRu ? "Курс" : "Course"} ${index + 1}`}
            </h2>
            <ConfidenceBadge value={course.confidence} />
            {!course.include && (
              <span className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                {isRu ? "Исключён" : "Excluded"}
              </span>
            )}
          </div>
          {decision.match && (
            <p className="mt-1 text-xs text-yellow-200">
              {isRu ? "Найден существующий курс" : "Existing course found"}: {decision.match.course.title}
              {decision.match.course.number ? ` · ${decision.match.course.number}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={course.include ? decision.action : "skip"}
            onValueChange={(value) => {
              if (value === "skip") {
                update({ include: false });
                onDecision({ ...decision, action: "skip" });
              } else {
                update({ include: true });
                onDecision({ ...decision, action: value as "create" | "update" });
              }
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {decision.match && <SelectItem value="update">{isRu ? "Обновить найденный" : "Update match"}</SelectItem>}
              <SelectItem value="create">{isRu ? "Создать новый" : "Create new"}</SelectItem>
              <SelectItem value="skip">{isRu ? "Пропустить" : "Skip"}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" aria-label={isRu ? "Удалить из черновика" : "Remove from draft"} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ReviewField label={isRu ? "Название курса" : "Course title"} confidence={course.fieldConfidence.title}>
          <Input dir="auto" value={course.title} onChange={(event) => update({ title: event.target.value })} />
        </ReviewField>
        <ReviewField label={isRu ? "Код курса" : "Course code"} confidence={course.fieldConfidence.number}>
          <Input value={course.number ?? ""} onChange={(event) => update({ number: event.target.value })} />
        </ReviewField>
        <ReviewField label={isRu ? "Преподаватель" : "Instructor"} confidence={course.fieldConfidence.instructor}>
          <Input dir="auto" value={course.instructor ?? ""} onChange={(event) => update({ instructor: event.target.value })} />
        </ReviewField>
        <ReviewField label={isRu ? "Кредиты" : "Credits"} confidence={course.fieldConfidence.credits}>
          <Input
            inputMode="decimal"
            value={course.credits ?? ""}
            onChange={(event) => {
              const value = event.target.value.replace(",", ".");
              update({ credits: value === "" ? undefined : Number(value) });
            }}
          />
        </ReviewField>
        <ReviewField label={isRu ? "Семестр" : "Semester"} confidence={course.fieldConfidence.semester}>
          <Input dir="auto" value={course.semester ?? ""} onChange={(event) => update({ semester: event.target.value })} />
        </ReviewField>
        <ReviewField label={isRu ? "Тип курса" : "Course type"}>
          <Input dir="auto" value={course.type ?? ""} onChange={(event) => update({ type: event.target.value })} />
        </ReviewField>
      </div>

      <div className="mt-4">
        <ReviewField label={isRu ? "Описание" : "Description"} confidence={course.fieldConfidence.description}>
          <Textarea dir="auto" className="min-h-[110px] resize-y" value={course.description ?? ""} onChange={(event) => update({ description: event.target.value })} />
        </ReviewField>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <EditableList title={isRu ? "Темы / недели" : "Topics / weeks"} items={course.topics} onChange={(topics) => update({ topics })} />
        <EditableList title={isRu ? "Литература" : "Readings"} items={course.readings} onChange={(readings) => update({ readings })} />
        <EditableList title={isRu ? "Задания" : "Assignments"} items={course.assignments} onChange={(assignments) => update({ assignments })} />
        <EditableList title={isRu ? "Экзамены" : "Exams"} items={course.exams} onChange={(exams) => update({ exams })} />
        <div className="lg:col-span-2">
          <EditableList title={isRu ? "Состав оценки" : "Grading"} items={course.grading} onChange={(grading) => update({ grading })} />
        </div>
      </div>

      {course.warnings.length > 0 && (
        <div className="mt-4 rounded-md border border-yellow-500/25 bg-yellow-500/5 p-3 text-xs text-yellow-100">
          <strong>{isRu ? "Неуверенные места" : "Uncertain fields"}</strong>
          <ul className="mt-1 list-disc ps-5 text-muted-foreground">
            {course.warnings.map((warning) => (
              <li key={warning}>{warning.replaceAll("_", " ")}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function ReviewField({
  label,
  confidence,
  children,
}: {
  label: string;
  confidence?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {confidence != null && <ConfidenceBadge value={confidence} compact />}
      </div>
      {children}
    </div>
  );
}

function ConfidenceBadge({ value, compact = false }: { value: number; compact?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const className =
    pct >= 75
      ? "bg-emerald-500/10 text-emerald-300"
      : pct >= 55
        ? "bg-yellow-500/10 text-yellow-200"
        : "bg-orange-500/10 text-orange-200";
  return (
    <span className={`rounded px-1.5 py-0.5 ${compact ? "text-[10px]" : "text-xs"} ${className}`}>
      {pct}%
    </span>
  );
}

function EditableList({
  title,
  items,
  onChange,
}: {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-[10px] text-muted-foreground">{items.length}</span>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={`${index}_${item}`} className="flex items-start gap-2">
            <Input
              dir="auto"
              value={item}
              onChange={(event) =>
                onChange(items.map((current, itemIndex) => (itemIndex === index ? event.target.value : current)))
              }
            />
            <Button size="icon" variant="ghost" aria-label={isRu ? "Удалить" : "Delete"} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => onChange([...items, ""])}>
          <Plus className="h-3.5 w-3.5 me-1" />
          {isRu ? "Добавить" : "Add"}
        </Button>
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function ImportHistory() {
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <h2 className="font-serif text-xl font-semibold">{isRu ? "История импорта" : "Import history"}</h2>
      {data.syllabusImports.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {isRu ? "Подтверждённых импортов пока нет." : "No confirmed imports yet."}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {data.syllabusImports.slice(0, 10).map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-3 text-xs">
              <span className="rounded bg-primary/10 px-2 py-1 uppercase text-primary">{item.source}</span>
              <span className="font-medium">{item.fileName ?? item.programName ?? "—"}</span>
              <span className="text-muted-foreground">
                {item.courseIds.length} {isRu ? "курс(а)" : "course(s)"}
              </span>
              <span className="ms-auto text-muted-foreground">{new Date(item.createdAt).toLocaleString(isRu ? "ru-RU" : "en-GB")}</span>
              {item.courseIds[0] && (
                <Link to="/app/courses/$courseId" params={{ courseId: item.courseIds[0] }} className="text-primary hover:underline">
                  {isRu ? "Открыть" : "Open"}
                </Link>
              )}
              <Button size="icon" variant="ghost" aria-label={isRu ? "Удалить запись истории" : "Delete history entry"} onClick={() => store.deleteSyllabusImport(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
