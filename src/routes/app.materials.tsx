import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import {
  useData,
  store,
  type MaterialType,
  type MaterialProcessingStatus,
  type MaterialExtractionMethod,
} from "@/lib/store";
import { classifyFile, formatFileSize } from "@/lib/document-ingestion";
import { intakeFile, intakeText } from "@/lib/material-intake";
import { Upload, ClipboardPaste, Trash2, Search, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/materials")({
  component: MaterialsPage,
});

function materialTypeLabel(t: ReturnType<typeof useApp>["t"], value: MaterialType): string {
  switch (value) {
    case "syllabus":
      return t.syllabus;
    case "lecture":
      return t.lecture;
    case "article":
      return t.article;
    case "assignment":
      return t.assignments;
    case "presentation":
      return t.presentationMat;
    case "exam":
      return t.exam;
    default:
      return t.other;
  }
}

function processingStatusLabel(
  t: ReturnType<typeof useApp>["t"],
  status: MaterialProcessingStatus,
): string {
  switch (status) {
    case "ready":
      return t.statusReady;
    case "unsupported":
      return t.statusUnsupported;
    case "error":
      return t.statusError;
    case "no_text":
      return t.statusNoText;
    case "partial":
      return t.statusPartial;
  }
}

function processingStatusClass(status: MaterialProcessingStatus): string {
  switch (status) {
    case "ready":
      return "bg-emerald-500/15 text-emerald-300";
    case "unsupported":
      return "bg-yellow-500/15 text-yellow-300";
    case "error":
      return "bg-red-500/15 text-red-300";
    case "no_text":
      return "bg-orange-500/15 text-orange-300";
    case "partial":
      return "bg-sky-500/15 text-sky-300";
  }
}

function extractionMethodLabel(
  t: ReturnType<typeof useApp>["t"],
  method?: MaterialExtractionMethod,
): string {
  if (!method) return "";
  const labels: Record<MaterialExtractionMethod, string> = {
    manual: t.extMethodManual,
    txt: t.extMethodTxt,
    markdown: t.extMethodMarkdown,
    csv: t.extMethodCsv,
    json: t.extMethodJson,
    html: t.extMethodHtml,
    xml: t.extMethodXml,
    yaml: t.extMethodYaml,
    xlsx: t.extMethodXlsx,
    docx: t.extMethodDocx,
    pdf: t.extMethodPdf,
  };
  return labels[method];
}

function MaterialsPage() {
  const { t, lang } = useApp();
  const data = useData();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const untitled = lang === "ru" ? "Без названия" : "Untitled";

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    data.materials.forEach((material) => material.tags.forEach((tag) => tags.add(tag)));
    return [...tags].sort();
  }, [data.materials]);

  const chunksByMaterial = useMemo(() => {
    const counts = new Map<string, number>();
    for (const chunk of data.materialChunks) {
      counts.set(chunk.materialId, (counts.get(chunk.materialId) || 0) + 1);
    }
    return counts;
  }, [data.materialChunks]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return data.materials.filter((material) => {
      if (typeFilter !== "all" && material.type !== typeFilter) return false;
      if (courseFilter !== "all" && material.courseId !== courseFilter) return false;
      if (statusFilter !== "all" && material.processingStatus !== statusFilter) return false;
      if (methodFilter !== "all" && material.extractionMethod !== methodFilter) return false;
      if (tagFilter !== "all" && !material.tags.includes(tagFilter)) return false;
      if (!query) return true;
      if (material.title.toLowerCase().includes(query)) return true;
      if (material.rawText.toLowerCase().includes(query)) return true;
      if (material.tags.some((tag) => tag.toLowerCase().includes(query))) return true;
      return data.materialChunks.some(
        (chunk) => chunk.materialId === material.id && chunk.text.toLowerCase().includes(query),
      );
    });
  }, [
    data.materials,
    data.materialChunks,
    search,
    typeFilter,
    courseFilter,
    statusFilter,
    methodFilter,
    tagFilter,
  ]);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={t.materials}
        actions={
          <>
            <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
            <PasteDialog open={pasteOpen} onOpenChange={setPasteOpen} />
          </>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-full sm:min-w-[220px]">
          <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder={t.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder={t.materialType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.materialType} —</SelectItem>
            {(
              [
                "syllabus",
                "lecture",
                "article",
                "assignment",
                "presentation",
                "exam",
                "other",
              ] as const
            ).map((value) => (
              <SelectItem key={value} value={value}>
                {materialTypeLabel(t, value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder={t.filterStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.filterStatus} —</SelectItem>
            {(["ready", "unsupported", "error", "no_text", "partial"] as const).map((status) => (
              <SelectItem key={status} value={status}>
                {processingStatusLabel(t, status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={t.filterExtraction} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.filterExtraction} —</SelectItem>
            {(
              [
                "manual",
                "txt",
                "markdown",
                "csv",
                "json",
                "html",
                "xml",
                "yaml",
                "xlsx",
                "docx",
                "pdf",
              ] as const
            ).map((method) => (
              <SelectItem key={method} value={method}>
                {extractionMethodLabel(t, method)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t.linkedCourse} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.linkedCourse} —</SelectItem>
            {data.courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder={t.filterTag} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">— {t.filterTag} —</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.materialsEmptyV2}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((material) => {
            const course = data.courses.find((item) => item.id === material.courseId);
            const chunkCount = chunksByMaterial.get(material.id) || 0;
            return (
              <article key={material.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/app/materials/$materialId"
                    params={{ materialId: material.id }}
                    className="font-semibold hover:underline min-w-0 truncate"
                  >
                    {material.title || untitled}
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t.delete}
                    onClick={() => {
                      if (confirm(`${t.confirm}?`)) store.deleteMaterial(material.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                  <span
                    className={`rounded px-2 py-0.5 ${processingStatusClass(material.processingStatus)}`}
                  >
                    {processingStatusLabel(t, material.processingStatus)}
                  </span>
                  <span className="rounded bg-background px-2 py-0.5 text-muted-foreground">
                    {materialTypeLabel(t, material.type)}
                  </span>
                  {material.extractionMethod && (
                    <span className="rounded bg-background px-2 py-0.5 text-muted-foreground">
                      {extractionMethodLabel(t, material.extractionMethod)}
                    </span>
                  )}
                  {course && (
                    <span className="rounded bg-background px-2 py-0.5 text-muted-foreground">
                      {course.title}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span>
                    {t.chunkCount}: <b className="text-foreground">{chunkCount}</b>
                  </span>
                  <span>
                    {t.wordCount}: <b className="text-foreground">{material.wordCount ?? 0}</b>
                  </span>
                  {material.fileName && (
                    <span className="truncate max-w-[160px]">{material.fileName}</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {material.rawText.slice(0, 220) || material.processingMessage || "—"}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, lang } = useApp();
  const data = useData();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("lecture");
  const [courseId, setCourseId] = useState("_none");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const classification = file ? classifyFile(file) : null;

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const result = await intakeFile(file, {
        title,
        type,
        courseId: courseId === "_none" ? undefined : courseId,
      });
      if (result.outcome === "success") {
        toast.success(lang === "ru" ? "Материал добавлен" : "Material added");
      } else if (result.outcome === "partial") {
        toast.warning(
          result.message ||
            (lang === "ru" ? "Материал добавлен частично" : "Material added partially"),
        );
      } else {
        toast.error(
          result.message ||
            (lang === "ru" ? "Материал сохранён с ошибкой" : "Material saved with an error"),
        );
      }
      setTitle("");
      setFile(null);
      setType("lecture");
      setCourseId("_none");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.processingError);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 me-1" />
          {t.uploadFile}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.uploadFile}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4 me-1" />
            {file ? file.name : t.uploadFile}
          </Button>
          <div>
            <Label>{t.title}</Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={file?.name || ""}
            />
          </div>
          <div>
            <Label>{t.materialType}</Label>
            <Select value={type} onValueChange={(value) => setType(value as MaterialType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    "syllabus",
                    "lecture",
                    "article",
                    "assignment",
                    "presentation",
                    "exam",
                    "other",
                  ] as const
                ).map((value) => (
                  <SelectItem key={value} value={value}>
                    {materialTypeLabel(t, value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.linkedCourse}</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— {t.none} —</SelectItem>
                {data.courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {file && !classification?.isText && !classification?.extractionMethod && (
            <p className="text-xs text-yellow-300">
              {t.materialUnsupportedPaste} {formatFileSize(file.size)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t.cancel}
            </Button>
            <Button disabled={!file || busy} onClick={submit}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 me-1 animate-spin" />
                  {t.extractingFile}
                </>
              ) : (
                t.save
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PasteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, lang } = useApp();
  const data = useData();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("article");
  const [courseId, setCourseId] = useState("_none");
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    const result = intakeText(text, {
      title: title || (lang === "ru" ? "Вставленный текст" : "Pasted text"),
      type,
      courseId: courseId === "_none" ? undefined : courseId,
    });
    if (result.ok) {
      toast.success(lang === "ru" ? "Материал добавлен" : "Material added");
    } else {
      toast.error(result.message || t.processingError);
    }
    setTitle("");
    setText("");
    setType("article");
    setCourseId("_none");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <ClipboardPaste className="h-4 w-4 me-1" />
          {t.pasteText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.pasteText}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t.title}</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t.materialType}</Label>
              <Select value={type} onValueChange={(value) => setType(value as MaterialType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "syllabus",
                      "lecture",
                      "article",
                      "assignment",
                      "presentation",
                      "exam",
                      "other",
                    ] as const
                  ).map((value) => (
                    <SelectItem key={value} value={value}>
                      {materialTypeLabel(t, value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.linkedCourse}</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— {t.none} —</SelectItem>
                  {data.courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>
              <FileText className="inline h-3.5 w-3.5 me-1" />
              {t.rawText}
            </Label>
            <textarea
              className="w-full min-h-[240px] rounded-md border border-input bg-background p-3 text-sm font-mono"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button onClick={submit} disabled={!text.trim()}>
              {t.save}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
