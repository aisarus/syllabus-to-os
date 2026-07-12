import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  FileInput,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
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
import { checkAIStatus } from "@/lib/ai";
import { parseCourseSyllabusWithAI } from "@/lib/course-syllabus-ai";
import {
  applyCourseSyllabusDraft,
  createDeterministicCourseSyllabusDraft,
  findCourseSyllabusDuplicates,
  findExistingSyllabusMaterial,
  type CourseSyllabusDraft,
  type SyllabusAssessmentDraft,
  type SyllabusAssessmentType,
  type SyllabusReadingDraft,
  type SyllabusTopicDraft,
} from "@/lib/course-syllabus";
import { formatFileSize, ingestPastedText, type IngestResult } from "@/lib/document-ingestion";
import {
  intakeText,
  persistPreparedFile,
  prepareFileIntake,
  type PreparedFileIntake,
} from "@/lib/material-intake";
import { store, uid, useData } from "@/lib/store";

export const Route = createFileRoute("/app/course-syllabus")({
  component: CourseSyllabusPage,
});

type SourceState = {
  mode: "file" | "text";
  fileName: string;
  rawText: string;
  extraction: IngestResult;
  prepared?: PreparedFileIntake;
};

type ParserMeta = {
  source: "deterministic" | "ai";
  model?: string;
  promptVersion?: string;
  aiError?: string;
};

function CourseSyllabusPage() {
  const { lang } = useAppLanguage();
  const isRu = lang === "ru";
  const data = useData();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [source, setSource] = useState<SourceState | null>(null);
  const [draft, setDraft] = useState<CourseSyllabusDraft | null>(null);
  const [parserMeta, setParserMeta] = useState<ParserMeta | null>(null);
  const [applyMode, setApplyMode] = useState<"create" | "update">("create");
  const [existingCourseId, setExistingCourseId] = useState("");
  const [saving, setSaving] = useState(false);

  const duplicateCandidates = useMemo(
    () => (draft ? findCourseSyllabusDuplicates(data, draft) : []),
    [data, draft],
  );
  const existingSource = useMemo(
    () =>
      source
        ? findExistingSyllabusMaterial(data, source.rawText, source.fileName)
        : undefined,
    [data, source],
  );

  const processSource = async (nextSource: SourceState) => {
    if (!nextSource.rawText.trim()) {
      toast.error(isRu ? "В источнике не найден текст" : "No text was found in the source");
      return;
    }
    setProcessing(true);
    try {
      const deterministic = createDeterministicCourseSyllabusDraft(
        nextSource.rawText,
        nextSource.fileName,
        nextSource.extraction.sourceLanguage,
      );
      let reviewed = deterministic;
      let meta: ParserMeta = { source: "deterministic" };
      const status = await checkAIStatus();
      if (status.configured) {
        const aiResult = await parseCourseSyllabusWithAI({
          fileName: nextSource.fileName,
          rawText: nextSource.rawText,
          locale: lang,
          deterministicDraft: deterministic,
        });
        if (aiResult.ok && aiResult.draft) {
          reviewed = aiResult.draft;
          meta = {
            source: "ai",
            model: aiResult.model,
            promptVersion: aiResult.promptVersion,
          };
        } else {
          meta = {
            source: "deterministic",
            model: aiResult.model,
            promptVersion: aiResult.promptVersion,
            aiError: aiResult.error,
          };
        }
      }

      const duplicates = findCourseSyllabusDuplicates(data, reviewed);
      const strongest = duplicates[0];
      setApplyMode(strongest && strongest.score >= 0.65 ? "update" : "create");
      setExistingCourseId(strongest && strongest.score >= 0.65 ? strongest.course.id : "");
      setSource(nextSource);
      setDraft(reviewed);
      setParserMeta(meta);
    } finally {
      setProcessing(false);
    }
  };

  const processFile = async (file: File) => {
    setProcessing(true);
    try {
      const prepared = await prepareFileIntake(file);
      if (
        prepared.extraction.status === "error" ||
        prepared.extraction.status === "unsupported"
      ) {
        toast.error(
          prepared.extraction.message ||
            (isRu ? "Не удалось извлечь текст" : "Could not extract text"),
        );
        return;
      }
      await processSource({
        mode: "file",
        fileName: file.name,
        rawText: prepared.extraction.rawText,
        extraction: prepared.extraction,
        prepared,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setProcessing(false);
    }
  };

  const processPastedText = async () => {
    const text = pastedText.trim();
    if (!text) {
      toast.error(isRu ? "Вставь текст силлабуса" : "Paste syllabus text first");
      return;
    }
    const extraction = ingestPastedText(text);
    await processSource({
      mode: "text",
      fileName: isRu ? "Вставленный силлабус" : "Pasted syllabus",
      rawText: extraction.rawText,
      extraction,
    });
  };

  const reset = () => {
    if (draft) {
      const confirmed = confirm(
        isRu
          ? "Сбросить проверенный черновик? В хранилище ещё ничего не применено."
          : "Discard the reviewed draft? Nothing has been applied to storage yet.",
      );
      if (!confirmed) return;
    }
    setDraft(null);
    setSource(null);
    setParserMeta(null);
    setPastedText("");
    setApplyMode("create");
    setExistingCourseId("");
  };

  const confirmAndApply = async () => {
    if (!draft || !source || saving) return;
    if (!draft.title.trim()) {
      toast.error(isRu ? "Укажи название курса" : "Course title is required");
      return;
    }
    if (applyMode === "update" && !existingCourseId) {
      toast.error(isRu ? "Выбери курс для обновления" : "Choose a course to update");
      return;
    }

    const includedTopics = draft.topics.filter((item) => item.include && item.title.trim()).length;
    const includedAssessments = draft.assessments.filter(
      (item) => item.include && item.title.trim(),
    ).length;
    const confirmed = confirm(
      isRu
        ? `${applyMode === "update" ? "Обновить существующий курс" : "Создать новый курс"} «${draft.title}»? Будет применено тем: ${includedTopics}, заданий и экзаменов: ${includedAssessments}.`
        : `${applyMode === "update" ? "Update the existing course" : "Create a new course"} “${draft.title}”? Topics: ${includedTopics}; assignments and exams: ${includedAssessments}.`,
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const result = applyCourseSyllabusDraft(draft, {
        mode: applyMode,
        existingCourseId: applyMode === "update" ? existingCourseId : undefined,
      });

      const existingMaterial = existingSource
        ? data.materials.find((item) => item.id === existingSource.id)
        : undefined;
      const existingBelongsElsewhere =
        existingMaterial?.courseId && existingMaterial.courseId !== result.courseId;
      const hasLinkedOutputs = existingMaterial
        ? data.notes.some((item) => item.materialId === existingMaterial.id) ||
          data.flashcards.some((item) => item.materialId === existingMaterial.id) ||
          data.quizzes.some((item) => item.materialId === existingMaterial.id) ||
          data.presentationOutlines.some((item) => item.materialId === existingMaterial.id) ||
          data.materialOutputs.some((item) => item.materialId === existingMaterial.id)
        : false;
      const safeExistingMaterialId =
        existingMaterial && !existingBelongsElsewhere && !hasLinkedOutputs
          ? existingMaterial.id
          : undefined;

      if (source.mode === "file" && source.prepared) {
        if (existingMaterial && !safeExistingMaterialId && !existingBelongsElsewhere) {
          store.updateMaterial(existingMaterial.id, {
            courseId: result.courseId,
            title: `${draft.title} — syllabus`,
            type: "syllabus",
          });
        } else {
          persistPreparedFile(source.prepared, {
            title: `${draft.title} — syllabus`,
            type: "syllabus",
            courseId: result.courseId,
            existingMaterialId: safeExistingMaterialId,
            tags: ["syllabus"],
          });
        }
      } else if (existingMaterial && !safeExistingMaterialId && !existingBelongsElsewhere) {
        store.updateMaterial(existingMaterial.id, {
          courseId: result.courseId,
          title: `${draft.title} — syllabus`,
          type: "syllabus",
        });
      } else {
        intakeText(source.rawText, {
          title: `${draft.title} — syllabus`,
          type: "syllabus",
          courseId: result.courseId,
          existingMaterialId: safeExistingMaterialId,
          tags: ["syllabus"],
        });
      }

      toast.success(
        result.created
          ? isRu
            ? "Курс создан из проверенного силлабуса"
            : "Course created from the reviewed syllabus"
          : isRu
            ? "Курс безопасно обновлён"
            : "Course updated safely",
      );
      navigate({ to: "/app/courses/$courseId", params: { courseId: result.courseId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={isRu ? "Импорт силлабуса курса" : "Import course syllabus"}
        subtitle={
          isRu
            ? "PDF, DOCX, XLSX или текст → проверка → один курс, темы, литература и оценки"
            : "PDF, DOCX, XLSX or text → review → one course, topics, readings and assessments"
        }
        actions={
          draft ? (
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 me-1" />
              {isRu ? "Начать заново" : "Start over"}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 rounded-md border border-border bg-surface p-3 text-sm text-muted-foreground">
        <p>
          {isRu
            ? "Этот поток предназначен для силлабуса одного курса. Данные не попадают в хранилище, пока ты не проверишь черновик и явно не подтвердишь импорт."
            : "This flow is for one course syllabus. Nothing enters storage until you review the draft and explicitly confirm the import."}
        </p>
        <Link
          to="/app/import-syllabus"
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {isRu
            ? "Расширенный импорт таблицы учебной программы с несколькими курсами"
            : "Advanced multi-course program table import"}
        </Link>
      </div>

      {!draft || !source ? (
        <SourceInput
          isRu={isRu}
          pastedText={pastedText}
          setPastedText={setPastedText}
          processing={processing}
          fileInput={fileInput}
          onFile={processFile}
          onPaste={processPastedText}
        />
      ) : (
        <div className="space-y-4">
          <ParserSummary
            isRu={isRu}
            source={source}
            draft={draft}
            parserMeta={parserMeta}
          />
          <CourseFields draft={draft} setDraft={setDraft} isRu={isRu} />
          <TopicsEditor draft={draft} setDraft={setDraft} isRu={isRu} />
          <ReadingsEditor draft={draft} setDraft={setDraft} isRu={isRu} />
          <AssessmentsEditor draft={draft} setDraft={setDraft} isRu={isRu} />
          <SourcePreview source={source} isRu={isRu} />
          <ConfirmationPanel
            draft={draft}
            isRu={isRu}
            duplicateCandidates={duplicateCandidates}
            existingSource={existingSource}
            applyMode={applyMode}
            setApplyMode={setApplyMode}
            existingCourseId={existingCourseId}
            setExistingCourseId={setExistingCourseId}
            courses={data.courses}
            saving={saving}
            onConfirm={confirmAndApply}
          />
        </div>
      )}
    </div>
  );
}

function SourceInput({
  isRu,
  pastedText,
  setPastedText,
  processing,
  fileInput,
  onFile,
  onPaste,
}: {
  isRu: boolean;
  pastedText: string;
  setPastedText: (value: string) => void;
  processing: boolean;
  fileInput: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  onPaste: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-border bg-surface p-5">
        <FileInput className="h-7 w-7 text-primary" />
        <h2 className="mt-3 font-serif text-xl font-semibold">
          {isRu ? "Загрузить файл" : "Upload a file"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isRu
            ? "Поддерживаются PDF, DOCX, XLSX, XLS, TXT и Markdown. Сначала извлекается текст, затем создаётся редактируемый черновик."
            : "Supports PDF, DOCX, XLSX, XLS, TXT and Markdown. Text is extracted first, then converted into an editable draft."}
        </p>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.markdown"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
            event.target.value = "";
          }}
        />
        <Button className="mt-5" onClick={() => fileInput.current?.click()} disabled={processing}>
          {processing ? (
            <Loader2 className="h-4 w-4 me-1 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 me-1" />
          )}
          {isRu ? "Выбрать силлабус" : "Choose syllabus"}
        </Button>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <ClipboardPaste className="h-7 w-7 text-primary" />
        <h2 className="mt-3 font-serif text-xl font-semibold">
          {isRu ? "Вставить текст" : "Paste text"}
        </h2>
        <Textarea
          dir="auto"
          className="mt-3 min-h-[220px] resize-y"
          value={pastedText}
          onChange={(event) => setPastedText(event.target.value)}
          placeholder={
            isRu
              ? "Вставь полный текст силлабуса на иврите, английском или русском…"
              : "Paste the full syllabus text in Hebrew, English or Russian…"
          }
        />
        <Button className="mt-3" onClick={onPaste} disabled={processing || !pastedText.trim()}>
          {processing ? (
            <Loader2 className="h-4 w-4 me-1 animate-spin" />
          ) : (
            <WandSparkles className="h-4 w-4 me-1" />
          )}
          {isRu ? "Разобрать и проверить" : "Parse and review"}
        </Button>
      </section>
    </div>
  );
}

function ParserSummary({
  isRu,
  source,
  draft,
  parserMeta,
}: {
  isRu: boolean;
  source: SourceState;
  draft: CourseSyllabusDraft;
  parserMeta: ParserMeta | null;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {parserMeta?.source === "ai" ? (
              <span className="rounded bg-primary/15 px-2 py-1 text-xs text-primary">
                {isRu ? "AI + детерминированный парсер" : "AI + deterministic parser"}
              </span>
            ) : (
              <span className="rounded bg-yellow-500/10 px-2 py-1 text-xs text-yellow-200">
                {isRu ? "Детерминированный fallback" : "Deterministic fallback"}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{source.fileName}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {source.extraction.wordCount.toLocaleString()} {isRu ? "слов" : "words"} ·{" "}
            {draft.topics.length} {isRu ? "тем" : "topics"} · {draft.readings.length}{" "}
            {isRu ? "источников литературы" : "readings"} · {draft.assessments.length}{" "}
            {isRu ? "оценочных элементов" : "assessments"}
          </p>
          {parserMeta?.model && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {parserMeta.model} · {parserMeta.promptVersion ?? "—"}
            </p>
          )}
        </div>
        <ConfidenceBadge value={averageConfidence(draft)} isRu={isRu} />
      </div>
      {parserMeta?.aiError && (
        <div className="mt-3 rounded border border-yellow-500/25 bg-yellow-500/5 p-2 text-xs text-yellow-100">
          {isRu
            ? `AI-разбор не сработал, поэтому показан честный локальный черновик: ${parserMeta.aiError}`
            : `AI parsing failed, so the honest local draft is shown: ${parserMeta.aiError}`}
        </div>
      )}
      {draft.warnings.length > 0 && (
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
          <span>{draft.warnings.join(" · ")}</span>
        </div>
      )}
    </section>
  );
}

function CourseFields({
  draft,
  setDraft,
  isRu,
}: {
  draft: CourseSyllabusDraft;
  setDraft: (value: CourseSyllabusDraft) => void;
  isRu: boolean;
}) {
  const update = (patch: Partial<CourseSyllabusDraft>) => setDraft({ ...draft, ...patch });
  return (
    <section className="rounded-lg border border-border bg-surface p-4 md:p-5">
      <h2 className="font-serif text-xl font-semibold">
        {isRu ? "Данные курса" : "Course details"}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ConfidenceField
          label={isRu ? "Название курса" : "Course title"}
          confidence={draft.confidence.title}
          isRu={isRu}
          className="sm:col-span-2"
        >
          <Input dir="auto" value={draft.title} onChange={(e) => update({ title: e.target.value })} />
        </ConfidenceField>
        <ConfidenceField
          label={isRu ? "Код курса" : "Course code"}
          confidence={draft.confidence.number}
          isRu={isRu}
        >
          <Input value={draft.number ?? ""} onChange={(e) => update({ number: e.target.value || undefined })} />
        </ConfidenceField>
        <ConfidenceField
          label={isRu ? "Преподаватель" : "Instructor"}
          confidence={draft.confidence.instructor}
          isRu={isRu}
        >
          <Input dir="auto" value={draft.instructor ?? ""} onChange={(e) => update({ instructor: e.target.value || undefined })} />
        </ConfidenceField>
        <ConfidenceField
          label={isRu ? "Кредиты" : "Credits"}
          confidence={draft.confidence.credits}
          isRu={isRu}
        >
          <Input
            type="number"
            min={0}
            max={30}
            step="0.5"
            value={draft.credits ?? ""}
            onChange={(e) =>
              update({ credits: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </ConfidenceField>
        <ConfidenceField
          label={isRu ? "Семестр" : "Semester"}
          confidence={draft.confidence.semester}
          isRu={isRu}
        >
          <Input dir="auto" value={draft.semester ?? ""} onChange={(e) => update({ semester: e.target.value || undefined })} />
        </ConfidenceField>
        <ConfidenceField
          label={isRu ? "Описание и цели" : "Description and objectives"}
          confidence={draft.confidence.description}
          isRu={isRu}
          className="sm:col-span-2"
        >
          <Textarea dir="auto" className="min-h-[130px] resize-y" value={draft.description ?? ""} onChange={(e) => update({ description: e.target.value || undefined })} />
        </ConfidenceField>
        <ConfidenceField
          label={isRu ? "Оценивание и требования" : "Grading and requirements"}
          confidence={draft.confidence.grading}
          isRu={isRu}
          className="sm:col-span-2"
        >
          <Textarea dir="auto" className="min-h-[130px] resize-y" value={draft.grading ?? ""} onChange={(e) => update({ grading: e.target.value || undefined })} />
        </ConfidenceField>
      </div>
    </section>
  );
}

function TopicsEditor({
  draft,
  setDraft,
  isRu,
}: {
  draft: CourseSyllabusDraft;
  setDraft: (value: CourseSyllabusDraft) => void;
  isRu: boolean;
}) {
  const update = (id: string, patch: Partial<SyllabusTopicDraft>) =>
    setDraft({
      ...draft,
      topics: draft.topics.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  const remove = (id: string) =>
    setDraft({ ...draft, topics: draft.topics.filter((item) => item.id !== id) });
  const move = (index: number, direction: "up" | "down") =>
    setDraft({ ...draft, topics: moveItem(draft.topics, index, direction) });

  return (
    <ReviewListSection
      title={isRu ? "Темы и недели" : "Topics and weeks"}
      count={draft.topics.length}
      onAdd={() =>
        setDraft({
          ...draft,
          topics: [
            ...draft.topics,
            { id: uid("stp"), include: true, title: "", confidence: 1, warnings: [] },
          ],
        })
      }
      isRu={isRu}
    >
      {draft.topics.map((item, index) => (
        <ReviewRow key={item.id} included={item.include} onInclude={(include) => update(item.id, { include })}>
          <div className="grid flex-1 gap-2 sm:grid-cols-[90px_minmax(0,1fr)]">
            <Input value={item.week ?? ""} onChange={(e) => update(item.id, { week: e.target.value || undefined })} placeholder={isRu ? "Неделя" : "Week"} />
            <Input dir="auto" value={item.title} onChange={(e) => update(item.id, { title: e.target.value })} placeholder={isRu ? "Название темы" : "Topic title"} />
            <Textarea dir="auto" className="min-h-[70px] resize-y sm:col-span-2" value={item.description ?? ""} onChange={(e) => update(item.id, { description: e.target.value || undefined })} placeholder={isRu ? "Описание — необязательно" : "Optional description"} />
          </div>
          <RowActions index={index} length={draft.topics.length} onMove={move} onDelete={() => remove(item.id)} isRu={isRu} />
          <ConfidenceBadge value={item.confidence} isRu={isRu} compact />
        </ReviewRow>
      ))}
    </ReviewListSection>
  );
}

function ReadingsEditor({
  draft,
  setDraft,
  isRu,
}: {
  draft: CourseSyllabusDraft;
  setDraft: (value: CourseSyllabusDraft) => void;
  isRu: boolean;
}) {
  const update = (id: string, patch: Partial<SyllabusReadingDraft>) =>
    setDraft({
      ...draft,
      readings: draft.readings.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  return (
    <ReviewListSection
      title={isRu ? "Литература" : "Readings"}
      count={draft.readings.length}
      onAdd={() =>
        setDraft({
          ...draft,
          readings: [
            ...draft.readings,
            { id: uid("srd"), include: true, citation: "", confidence: 1 },
          ],
        })
      }
      isRu={isRu}
    >
      {draft.readings.map((item) => (
        <ReviewRow key={item.id} included={item.include} onInclude={(include) => update(item.id, { include })}>
          <Textarea dir="auto" className="min-h-[70px] flex-1 resize-y" value={item.citation} onChange={(e) => update(item.id, { citation: e.target.value })} placeholder={isRu ? "Библиографическая запись или ссылка" : "Citation or link"} />
          <Button size="icon" variant="ghost" aria-label={isRu ? "Удалить" : "Delete"} onClick={() => setDraft({ ...draft, readings: draft.readings.filter((reading) => reading.id !== item.id) })}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <ConfidenceBadge value={item.confidence} isRu={isRu} compact />
        </ReviewRow>
      ))}
    </ReviewListSection>
  );
}

function AssessmentsEditor({
  draft,
  setDraft,
  isRu,
}: {
  draft: CourseSyllabusDraft;
  setDraft: (value: CourseSyllabusDraft) => void;
  isRu: boolean;
}) {
  const update = (id: string, patch: Partial<SyllabusAssessmentDraft>) =>
    setDraft({
      ...draft,
      assessments: draft.assessments.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  return (
    <ReviewListSection
      title={isRu ? "Задания, экзамены и проекты" : "Assignments, exams and projects"}
      count={draft.assessments.length}
      onAdd={() =>
        setDraft({
          ...draft,
          assessments: [
            ...draft.assessments,
            {
              id: uid("sas"),
              include: true,
              type: "assignment",
              title: "",
              confidence: 1,
              warnings: [],
            },
          ],
        })
      }
      isRu={isRu}
    >
      {draft.assessments.map((item) => (
        <ReviewRow key={item.id} included={item.include} onInclude={(include) => update(item.id, { include })}>
          <div className="grid flex-1 gap-2 sm:grid-cols-[150px_minmax(0,1fr)_150px_100px]">
            <Select value={item.type} onValueChange={(value) => update(item.id, { type: value as SyllabusAssessmentType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["assignment", "exam", "presentation", "project", "other"] as const).map((type) => (
                  <SelectItem key={type} value={type}>{assessmentTypeCopy(type, isRu)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input dir="auto" value={item.title} onChange={(e) => update(item.id, { title: e.target.value })} placeholder={isRu ? "Название" : "Title"} />
            <Input type="date" value={item.dueDate ?? ""} onChange={(e) => update(item.id, { dueDate: e.target.value || undefined })} />
            <Input value={item.weight ?? ""} onChange={(e) => update(item.id, { weight: e.target.value || undefined })} placeholder="%" />
            <Textarea dir="auto" className="min-h-[70px] resize-y sm:col-span-4" value={item.description ?? ""} onChange={(e) => update(item.id, { description: e.target.value || undefined })} placeholder={isRu ? "Требования и детали" : "Requirements and details"} />
          </div>
          <Button size="icon" variant="ghost" aria-label={isRu ? "Удалить" : "Delete"} onClick={() => setDraft({ ...draft, assessments: draft.assessments.filter((assessment) => assessment.id !== item.id) })}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <ConfidenceBadge value={item.confidence} isRu={isRu} compact />
        </ReviewRow>
      ))}
    </ReviewListSection>
  );
}

function SourcePreview({ source, isRu }: { source: SourceState; isRu: boolean }) {
  return (
    <details className="rounded-lg border border-border bg-surface">
      <summary className="cursor-pointer p-4 font-semibold">
        {isRu ? "Извлечённый текст и диагностика" : "Extracted text and diagnostics"}
      </summary>
      <div className="border-t border-border p-4">
        <dl className="mb-3 grid gap-2 text-xs sm:grid-cols-4">
          <Diag label={isRu ? "Статус" : "Status"} value={source.extraction.status} />
          <Diag label={isRu ? "Язык" : "Language"} value={source.extraction.sourceLanguage} />
          <Diag label={isRu ? "Метод" : "Method"} value={source.extraction.extractionMethod ?? "—"} />
          <Diag label={isRu ? "Размер" : "Size"} value={source.prepared ? formatFileSize(source.prepared.fileSize) : `${source.rawText.length.toLocaleString()} chars`} />
        </dl>
        {source.extraction.message && (
          <div className="mb-3 rounded border border-yellow-500/25 bg-yellow-500/5 p-2 text-xs text-yellow-100">
            {source.extraction.message}
          </div>
        )}
        <pre dir="auto" className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-xs leading-6">
          {source.rawText}
        </pre>
      </div>
    </details>
  );
}

function ConfirmationPanel({
  draft,
  isRu,
  duplicateCandidates,
  existingSource,
  applyMode,
  setApplyMode,
  existingCourseId,
  setExistingCourseId,
  courses,
  saving,
  onConfirm,
}: {
  draft: CourseSyllabusDraft;
  isRu: boolean;
  duplicateCandidates: ReturnType<typeof findCourseSyllabusDuplicates>;
  existingSource?: { id: string; title: string };
  applyMode: "create" | "update";
  setApplyMode: (mode: "create" | "update") => void;
  existingCourseId: string;
  setExistingCourseId: (id: string) => void;
  courses: ReturnType<typeof useData>["courses"];
  saving: boolean;
  onConfirm: () => void;
}) {
  return (
    <section className="rounded-lg border border-primary/35 bg-primary/5 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl font-semibold">
            {isRu ? "Подтверждение импорта" : "Confirm import"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRu
              ? "Только эта кнопка применит проверенные данные к хранилищу. Отмена или закрытие страницы ничего не создаёт."
              : "Only this button applies the reviewed data to storage. Cancelling or leaving the page creates nothing."}
          </p>

          {duplicateCandidates.length > 0 && (
            <div className="mt-4 rounded border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs">
              <strong className="text-yellow-100">
                {isRu ? "Похожие существующие курсы" : "Similar existing courses"}
              </strong>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {duplicateCandidates.slice(0, 5).map((candidate) => (
                  <li key={candidate.course.id}>
                    {Math.round(candidate.score * 100)}% · {candidate.course.number ? `${candidate.course.number} · ` : ""}{candidate.course.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {existingSource && (
            <div className="mt-3 rounded border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-100">
              {isRu
                ? `Похожий источник уже сохранён: «${existingSource.title}». Lamdan переиспользует или безопасно обновит его; связанный контент не будет осиротевшим.`
                : `A similar source already exists: “${existingSource.title}”. Lamdan will reuse or safely update it without orphaning linked content.`}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{isRu ? "Действие" : "Action"}</Label>
              <Select value={applyMode} onValueChange={(value) => setApplyMode(value as "create" | "update")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">{isRu ? "Создать отдельный курс" : "Create a separate course"}</SelectItem>
                  <SelectItem value="update" disabled={courses.length === 0}>{isRu ? "Обновить существующий курс" : "Update an existing course"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {applyMode === "update" && (
              <div>
                <Label>{isRu ? "Курс для обновления" : "Course to update"}</Label>
                <Select value={existingCourseId} onValueChange={setExistingCourseId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={isRu ? "Выбери курс" : "Choose course"} /></SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>{course.number ? `${course.number} · ` : ""}{course.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-primary/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {draft.topics.filter((item) => item.include).length} {isRu ? "тем" : "topics"} · {draft.readings.filter((item) => item.include).length} {isRu ? "источников" : "readings"} · {draft.assessments.filter((item) => item.include).length} {isRu ? "заданий/экзаменов" : "assessments"}
            </p>
            <Button onClick={onConfirm} disabled={saving || !draft.title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 me-1" />}
              {applyMode === "update"
                ? isRu ? "Подтвердить и обновить курс" : "Confirm and update course"
                : isRu ? "Подтвердить и создать курс" : "Confirm and create course"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewListSection({
  title,
  count,
  onAdd,
  isRu,
  children,
}: {
  title: string;
  count: number;
  onAdd: () => void;
  isRu: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold">{title} · {count}</h2>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-4 w-4 me-1" />
          {isRu ? "Добавить" : "Add"}
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {count === 0 && (
          <div className="rounded border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            {isRu ? "Ничего не извлечено. Добавь вручную или оставь раздел пустым." : "Nothing was extracted. Add items manually or leave this section empty."}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function ReviewRow({
  included,
  onInclude,
  children,
}: {
  included: boolean;
  onInclude: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-md border p-3 lg:flex-row lg:items-start ${included ? "border-border bg-background" : "border-border/50 bg-muted/20 opacity-65"}`}>
      <input type="checkbox" className="mt-2" checked={included} onChange={(e) => onInclude(e.target.checked)} />
      {children}
    </div>
  );
}

function RowActions({
  index,
  length,
  onMove,
  onDelete,
  isRu,
}: {
  index: number;
  length: number;
  onMove: (index: number, direction: "up" | "down") => void;
  onDelete: () => void;
  isRu: boolean;
}) {
  return (
    <div className="flex gap-1">
      <Button size="icon" variant="ghost" aria-label={isRu ? "Выше" : "Move up"} disabled={index === 0} onClick={() => onMove(index, "up")}><ArrowUp className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" aria-label={isRu ? "Ниже" : "Move down"} disabled={index === length - 1} onClick={() => onMove(index, "down")}><ArrowDown className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" aria-label={isRu ? "Удалить" : "Delete"} onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

function ConfidenceField({
  label,
  confidence,
  isRu,
  className,
  children,
}: {
  label: string;
  confidence: number;
  isRu: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <ConfidenceBadge value={confidence} isRu={isRu} compact />
      </div>
      {children}
    </div>
  );
}

function ConfidenceBadge({ value, isRu, compact = false }: { value: number; isRu: boolean; compact?: boolean }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const className = percent >= 80 ? "text-emerald-300 bg-emerald-500/10" : percent >= 55 ? "text-yellow-200 bg-yellow-500/10" : "text-orange-200 bg-orange-500/10";
  return <span className={`shrink-0 rounded px-2 py-1 ${compact ? "text-[10px]" : "text-xs"} ${className}`}>{isRu ? "уверенность" : "confidence"} {percent}%</span>;
}

function Diag({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 font-mono text-foreground">{value}</dd></div>;
}

function averageConfidence(draft: CourseSyllabusDraft): number {
  const values = Object.values(draft.confidence);
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function assessmentTypeCopy(type: SyllabusAssessmentType, isRu: boolean): string {
  const map: Record<SyllabusAssessmentType, [string, string]> = {
    assignment: ["Задание", "Assignment"],
    exam: ["Экзамен", "Exam"],
    presentation: ["Презентация", "Presentation"],
    project: ["Проект", "Project"],
    other: ["Другое", "Other"],
  };
  return map[type][isRu ? 0 : 1];
}

function moveItem<T>(items: T[], index: number, direction: "up" | "down"): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function useAppLanguage(): { lang: "ru" | "en" } {
  // Keep this route's copy local while the shared dictionary catches up.
  const stored = typeof window === "undefined" ? null : localStorage.getItem("lamdan.lang");
  return { lang: stored === "en" ? "en" : "ru" };
}
