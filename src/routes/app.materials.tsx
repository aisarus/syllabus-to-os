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
import { useData, store, type MaterialType } from "@/lib/store";
import { classifyFile, readFileAsText, formatFileSize } from "@/lib/materials";
import { Plus, Upload, ClipboardPaste, Trash2, Search, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/materials")({
  component: MaterialsPage,
});

function MaterialsPage() {
  const { t } = useApp();
  const data = useData();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.materials.filter(
      (m) =>
        (typeFilter === "all" || m.type === typeFilter) &&
        (courseFilter === "all" || m.courseId === courseFilter) &&
        (!q ||
          m.title.toLowerCase().includes(q) ||
          m.rawText.toLowerCase().includes(q) ||
          m.tags.some((tag) => tag.toLowerCase().includes(q))),
    );
  }, [data.materials, search, typeFilter, courseFilter]);

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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t.materialType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.materialType} —</SelectItem>
            {(["syllabus","lecture","article","assignment","presentation","exam","other"] as const).map((v) => (
              <SelectItem key={v} value={v}>{matTypeLabel(t, v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t.linkedCourse} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— {t.linkedCourse} —</SelectItem>
            {data.courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.materialsEmpty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => {
            const course = data.courses.find((c) => c.id === m.courseId);
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
                <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  <span className="rounded bg-background px-2 py-0.5 uppercase">
                    {matTypeLabel(t, m.type)}
                  </span>
                  {course && <span className="rounded bg-background px-2 py-0.5">{course.title}</span>}
                  {m.fileName && <span className="rounded bg-background px-2 py-0.5">{m.fileName}</span>}
                  {m.processingStatus === "unsupported" && (
                    <span className="rounded bg-yellow-500/15 text-yellow-300 px-2 py-0.5">{t.notConnected}</span>
                  )}
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

  const submit = async () => {
    if (!file) return;
    const cls = classifyFile(file);
    let rawText = "";
    let status = cls.status;
    let msg = cls.message;
    if (cls.isText) {
      try {
        rawText = await readFileAsText(file);
        if (!rawText.trim()) {
          status = "no_text";
          msg = "File contains no readable text.";
        }
      } catch (e) {
        status = "error";
        msg = (e as Error).message;
      }
    }
    store.createMaterial({
      title: title || file.name,
      type,
      sourceMode: "uploaded_file",
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      courseId: courseId === "_none" ? undefined : courseId,
      tags: [],
      rawText,
      processingStatus: status,
      processingMessage: msg,
    });
    setTitle(""); setFile(null); setType("lecture"); setCourseId("_none");
    onOpenChange(false);
    toast.success(t.save);
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
          {file && !classifyFile(file).isText && (
            <p className="text-xs text-yellow-300">
              {t.processingUnsupported}. {formatFileSize(file.size)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
            <Button disabled={!file} onClick={submit}>{t.save}</Button>
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
    store.createMaterial({
      title: title || "Pasted text",
      type,
      sourceMode: "pasted_text",
      courseId: courseId === "_none" ? undefined : courseId,
      tags: [],
      rawText: text,
      processingStatus: "ready",
    });
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

// Re-export the plus icon so nothing warns when tree-shaking
export const _ = Plus;
