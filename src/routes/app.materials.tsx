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
import {
  classifyFile,
  formatFileSize,
  ingestFile,
  ingestPastedText,
} from "@/lib/document-ingestion";
import { Upload, ClipboardPaste, Trash2, Search, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/materials")({
  component: MaterialsPage,
});

function matTypeLabel(t: ReturnType<typeof useApp>["t"], v: MaterialType): string {
  switch (v) {
    case "syllabus": return t.syllabus;
    case "lecture": return t.lecture;
    case "article": return t.article;
    case "assignment": return t.assignments;
    case "presentation": return t.presentationMat;
    case "exam": return t.exam;
    default: return t.other;
  }
}

function statusLabel(t: ReturnType<typeof useApp>["t"], s: MaterialProcessingStatus): string {
  switch (s) {
    case "ready": return t.statusReady;
    case "unsupported": return t.statusUnsupported;
    case "error": return t.statusError;
    case "no_text": return t.statusNoText;
    case "partial": return t.statusPartial;
  }
}

function statusClass(s: MaterialProcessingStatus): string {
  switch (s) {
    case "ready": return "bg-emerald-500/15 text-emerald-300";
    case "unsupported": return "bg-yellow-500/15 text-yellow-300";
    case "error": return "bg-red-500/15 text-red-300";
    case "no_text": return "bg-orange-500/15 text-orange-300";
    case "partial": return "bg-sky-500/15 text-sky-300";
  }
}

function methodLabel(t: ReturnType<typeof useApp>["t"], m?: MaterialExtractionMethod): string {
  if (!m) return "";
  const map: Record<MaterialExtractionMethod, string> = {
    manual: t.extMethodManual, txt: t.extMethodTxt, markdown: t.extMethodMarkdown,
    csv: t.extMethodCsv, json: t.extMethodJson, html: t.extMethodHtml,
    xml: t.extMethodXml, yaml: t.extMethodYaml, xlsx: t.extMethodXlsx,
    docx: t.extMethodDocx, pdf: t.extMethodPdf,
  };
  return map[m];
}

function MaterialsPage() {
  const { t } = useApp();
  const data = useData();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    data.materials.forEach((m) => m.tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [data.materials]);

  const chunksByMaterial = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data.materialChunks) map.set(c.materialId, (map.get(c.materialId) || 0) + 1);
    return map;
  }, [data.materialChunks]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.materials.filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (courseFilter !== "all" && m.courseId !== courseFilter) return false;
      if (statusFilter !== "all" && m.processingStatus !== statusFilter) return false;
      if (methodFilter !== "all" && m.extractionMethod !== methodFilter) return false;
      if (tagFilter !== "all" && !m.tags.includes(tagFilter)) return false;
      if (!q) return true;
      if (m.title.toLowerCase().includes(q)) return true;
      if (m.rawText.toLowerCase().includes(q)) return true;
      if (m.tags.some((tg) => tg.toLowerCase().includes(q))) return true;
      // chunk text search
      return data.materialChunks.some(
        (ch) => ch.materialId === m.id && ch.text.toLowerCase().includes(q),
      );
    });
  }, [data.materials, data.materialChunks, search, typeFilter, courseFilter, statusFilter, methodFilter, tagFilter]);

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
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-8" placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder={t.materialType} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.materialType} —</SelectItem>
            {(["syllabus","lecture","article","assignment","presentation","exam","other"] as const).map((v) => (
              <SelectItem key={v} value={v}>{matTypeLabel(t, v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder={t.filterStatus} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.filterStatus} —</SelectItem>
            {(["ready","unsupported","error","no_text","partial"] as const).map((s) => (
              <SelectItem key={s} value={s}>{statusLabel(t, s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder={t.filterExtraction} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.filterExtraction} —</SelectItem>
            {(["manual","txt","markdown","csv","json","html","xml","yaml","xlsx","docx","pdf"] as const).map((m) => (
              <SelectItem key={m} value={m}>{methodLabel(t, m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={t.linkedCourse} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.linkedCourse} —</SelectItem>
            {data.courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder={t.filterTag} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">— {t.filterTag} —</SelectItem>
              {allTags.map((tg) => <SelectItem key={tg} value={tg}>{tg}</SelectItem>)}
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
          {filtered.map((m) => {
            const course = data.courses.find((c) => c.id === m.courseId);
            const chunkN = chunksByMaterial.get(m.id) || 0;
            return (
              <div key={m.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/app/materials/$materialId"
                    params={{ materialId: m.id }}
                    className="font-semibold hover:underline min-w-0 truncate"
                  >
                    {m.title || "Untitled"}
                  </Link>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(t.confirm + "?")) store.deleteMaterial(m.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                  <span className={`rounded px-2 py-0.5 ${statusClass(m.processingStatus)}`}>
                    {statusLabel(t, m.processingStatus)}
                  </span>
                  <span className="rounded bg-background px-2 py-0.5 uppercase text-muted-foreground">
                    {matTypeLabel(t, m.type)}
                  </span>
                  {m.extractionMethod && (
                    <span className="rounded bg-background px-2 py-0.5 text-muted-foreground">
                      {methodLabel(t, m.extractionMethod)}
                    </span>
                  )}
                  {course && <span className="rounded bg-background px-2 py-0.5 text-muted-foreground">{course.title}</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span>{t.chunkCount}: <b className="text-foreground">{chunkN}</b></span>
                  <span>{t.wordCount}: <b className="text-foreground">{m.wordCount ?? 0}</b></span>
                  {m.fileName && <span className="truncate max-w-[160px]">{m.fileName}</span>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {m.rawText.slice(0, 220) || "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useApp();
  const data = useData();
  const ref = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("lecture");
  const [courseId, setCourseId] = useState("_none");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const cls = file ? classifyFile(file) : null;

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await ingestFile(file);
      const mat = store.createMaterial({
        title: title || file.name,
        type,
        sourceMode: "uploaded_file",
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        courseId: courseId === "_none" ? undefined : courseId,
        tags: [],
        rawText: result.rawText,
        processingStatus: result.status,
        processingMessage: result.message,
        extractionMethod: result.extractionMethod,
        pageCount: result.pageCount,
        wordCount: result.wordCount,
        charCount: result.charCount,
        sourceLanguage: result.sourceLanguage,
      });
      if (result.chunks.length > 0) {
        store.replaceMaterialChunksForMaterial(mat.id, result.chunks);
      }
      setTitle(""); setFile(null); setType("lecture"); setCourseId("_none");
      onOpenChange(false);
      toast.success(t.save);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="h-4 w-4 me-1" />{t.uploadFile}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.uploadFile}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input
            ref={ref}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" onClick={() => ref.current?.click()}>
            <Upload className="h-4 w-4 me-1" />{file ? file.name : t.uploadFile}
          </Button>
          <div><Label>{t.title}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={file?.name || ""} /></div>
          <div>
            <Label>{t.materialType}</Label>
            <Select value={type} onValueChange={(v) => setType(v as MaterialType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["syllabus","lecture","article","assignment","presentation","exam","other"] as const).map((v) => (
                  <SelectItem key={v} value={v}>{matTypeLabel(t, v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.linkedCourse}</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— {t.none} —</SelectItem>
                {data.courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {file && !cls?.isText && !cls?.extractionMethod && (
            <p className="text-xs text-yellow-300">
              {t.materialUnsupportedPaste} {formatFileSize(file.size)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>{t.cancel}</Button>
            <Button disabled={!file || busy} onClick={submit}>
              {busy ? <><Loader2 className="h-4 w-4 me-1 animate-spin" />{t.extractingFile}</> : t.save}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PasteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useApp();
  const data = useData();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("article");
  const [courseId, setCourseId] = useState("_none");
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    const result = ingestPastedText(text);
    const mat = store.createMaterial({
      title: title || "Pasted text",
      type,
      sourceMode: "pasted_text",
      courseId: courseId === "_none" ? undefined : courseId,
      tags: [],
      rawText: result.rawText,
      processingStatus: result.status,
      extractionMethod: result.extractionMethod,
      wordCount: result.wordCount,
      charCount: result.charCount,
      sourceLanguage: result.sourceLanguage,
    });
    if (result.chunks.length > 0) {
      store.replaceMaterialChunksForMaterial(mat.id, result.chunks);
    }
    setTitle(""); setText(""); setType("article"); setCourseId("_none");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><ClipboardPaste className="h-4 w-4 me-1" />{t.pasteText}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t.pasteText}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>{t.title}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t.materialType}</Label>
              <Select value={type} onValueChange={(v) => setType(v as MaterialType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["syllabus","lecture","article","assignment","presentation","exam","other"] as const).map((v) => (
                    <SelectItem key={v} value={v}>{matTypeLabel(t, v)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.linkedCourse}</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— {t.none} —</SelectItem>
                  {data.courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label><FileText className="inline h-3.5 w-3.5 me-1" />{t.rawText}</Label>
            <textarea
              className="w-full min-h-[240px] rounded-md border border-input bg-background p-3 text-sm font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
            <Button onClick={submit} disabled={!text.trim()}>{t.save}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
