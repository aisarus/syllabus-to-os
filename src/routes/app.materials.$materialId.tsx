import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/lib/app-context";
import {
  useData,
  store,
  getChunksByMaterial,
  type MaterialType,
  type Material,
  type MaterialChunk,
  type MaterialExtractionMethod,
  type MaterialProcessingStatus,
  type MaterialSourceLanguage,
} from "@/lib/store";
import {
  createChunksFromText,
  formatFileSize,
  countWords,
  guessLanguage,
} from "@/lib/document-ingestion";
import {
  ArrowLeft, Plus, Trash2, Check, FileText, HelpCircle, Layers, Presentation,
  RefreshCw, Search, ClipboardList, StickyNote,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/materials/$materialId")({
  component: MaterialDetail,
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

function statusLabel(t: ReturnType<typeof useApp>["t"], s: MaterialProcessingStatus) {
  return ({ ready: t.statusReady, unsupported: t.statusUnsupported, error: t.statusError, no_text: t.statusNoText, partial: t.statusPartial } as const)[s];
}
function statusClass(s: MaterialProcessingStatus) {
  return ({
    ready: "bg-emerald-500/15 text-emerald-300",
    unsupported: "bg-yellow-500/15 text-yellow-300",
    error: "bg-red-500/15 text-red-300",
    no_text: "bg-orange-500/15 text-orange-300",
    partial: "bg-sky-500/15 text-sky-300",
  } as const)[s];
}
function methodLabel(t: ReturnType<typeof useApp>["t"], m?: MaterialExtractionMethod) {
  if (!m) return "—";
  const map: Record<MaterialExtractionMethod, string> = {
    manual: t.extMethodManual, txt: t.extMethodTxt, markdown: t.extMethodMarkdown,
    csv: t.extMethodCsv, json: t.extMethodJson, html: t.extMethodHtml, xml: t.extMethodXml,
    yaml: t.extMethodYaml, xlsx: t.extMethodXlsx, docx: t.extMethodDocx, pdf: t.extMethodPdf,
  };
  return map[m];
}
function langLabel(t: ReturnType<typeof useApp>["t"], l?: MaterialSourceLanguage) {
  if (!l) return "—";
  return ({ ru: t.langRu, en: t.langEn, he: t.langHe, ar: t.langAr, mixed: t.langMixed, unknown: t.langUnknown } as const)[l];
}

function MaterialDetail() {
  const { materialId } = Route.useParams();
  const { t } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const material = data.materials.find((m) => m.id === materialId);

  if (!material) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate({ to: "/app/materials" })}>
          <ArrowLeft className="h-4 w-4 me-1" />{t.back}
        </Button>
        <p className="mt-4 text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  const course = data.courses.find((c) => c.id === material.courseId);
  const chunks = getChunksByMaterial(data, material.id);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-xs text-muted-foreground mb-2 flex flex-wrap items-center gap-1">
        <Link to="/app/materials" className="hover:underline">{t.materials}</Link>
        <span>›</span>
        {course && (
          <>
            <Link to="/app/courses/$courseId" params={{ courseId: course.id }} className="hover:underline">{course.title}</Link>
            <span>›</span>
          </>
        )}
        <span className="text-foreground truncate">{material.title}</span>
      </div>

      <PageHeader
        title={
          <Input
            value={material.title}
            onChange={(e) => store.updateMaterial(material.id, { title: e.target.value })}
            className="text-2xl md:text-3xl font-bold bg-transparent border-transparent hover:border-input p-0 h-auto"
          />
        }
        actions={
          <Button variant="destructive" size="sm" onClick={() => { if (confirm(t.confirm + "?")) { store.deleteMaterial(material.id); navigate({ to: "/app/materials" }); } }}>
            <Trash2 className="h-4 w-4 me-1" />{t.delete}
          </Button>
        }
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{t.overview}</TabsTrigger>
          <TabsTrigger value="text">{t.rawText}</TabsTrigger>
          <TabsTrigger value="chunks">{t.chunks} · {chunks.length}</TabsTrigger>
          <TabsTrigger value="builder">{t.studyBuilder}</TabsTrigger>
          <TabsTrigger value="outputs">{t.outputs}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab material={material} chunks={chunks} />
        </TabsContent>
        <TabsContent value="text" className="mt-4">
          <RawTextTab material={material} />
        </TabsContent>
        <TabsContent value="chunks" className="mt-4">
          <ChunksTab material={material} chunks={chunks} />
        </TabsContent>
        <TabsContent value="builder" className="mt-4">
          <StudyBuilderTab material={material} chunks={chunks} />
        </TabsContent>
        <TabsContent value="outputs" className="mt-4">
          <OutputsTab materialId={material.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Overview ============

function OverviewTab({ material, chunks }: { material: Material; chunks: MaterialChunk[] }) {
  const { t } = useApp();
  const data = useData();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`text-xs rounded px-2 py-0.5 ${statusClass(material.processingStatus)}`}>
              {statusLabel(t, material.processingStatus)}
            </span>
            {material.extractionMethod && (
              <span className="text-xs rounded px-2 py-0.5 bg-background text-muted-foreground">
                {methodLabel(t, material.extractionMethod)}
              </span>
            )}
            <span className="text-xs rounded px-2 py-0.5 bg-background text-muted-foreground uppercase">
              {matTypeLabel(t, material.type)}
            </span>
          </div>
          {material.processingMessage && (
            <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200 mb-3">
              {material.processingMessage}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label={t.wordCount} value={material.wordCount ?? 0} />
            <Stat label={t.charCount} value={material.charCount ?? material.rawText.length} />
            <Stat label={t.chunkCount} value={chunks.length} />
            <Stat label={t.pageCount} value={material.pageCount ?? "—"} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 text-xs text-muted-foreground">
            <div>{t.sourceLanguage}: <span className="text-foreground">{langLabel(t, material.sourceLanguage)}</span></div>
            <div>{t.extractionMethod}: <span className="text-foreground">{methodLabel(t, material.extractionMethod)}</span></div>
          </div>
          {material.fileName && (
            <div className="mt-4 text-xs text-muted-foreground">
              <div className="uppercase text-[10px]">{t.fileMeta}</div>
              <div className="text-foreground">{material.fileName}</div>
              <div>{material.mimeType || "—"} · {formatFileSize(material.fileSize)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface p-4 text-xs space-y-2">
          <div className="text-muted-foreground uppercase text-[10px]">{t.materialType}</div>
          <Select value={material.type} onValueChange={(v) => store.updateMaterial(material.id, { type: v as MaterialType })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["syllabus","lecture","article","assignment","presentation","exam","other"] as const).map((v) => (
                <SelectItem key={v} value={v}>{matTypeLabel(t, v)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-muted-foreground uppercase text-[10px] mt-2">{t.linkedCourse}</div>
          <Select
            value={material.courseId ?? "_none"}
            onValueChange={(v) => store.updateMaterial(material.id, { courseId: v === "_none" ? undefined : v, topicId: undefined })}
          >
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— {t.none} —</SelectItem>
              {data.courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-muted-foreground uppercase text-[10px] mt-2">{t.linkedTopic}</div>
          <Select
            value={material.topicId ?? "_none"}
            onValueChange={(v) => store.updateMaterial(material.id, { topicId: v === "_none" ? undefined : v })}
          >
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— {t.none} —</SelectItem>
              {data.topics.filter((tp) => !material.courseId || tp.courseId === material.courseId).map((tp) => (
                <SelectItem key={tp.id} value={tp.id}>{tp.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-muted-foreground uppercase text-[10px] mt-2">{t.tags}</div>
          <Input
            className="h-8"
            value={material.tags.join(", ")}
            onChange={(e) => store.updateMaterial(material.id, { tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-background border border-border p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

// ============ Raw Text ============

function RawTextTab({ material }: { material: Material }) {
  const { t } = useApp();
  const [text, setText] = useState(material.rawText);
  const dirty = text !== material.rawText;

  const save = () => {
    store.updateMaterial(material.id, {
      rawText: text,
      wordCount: countWords(text),
      charCount: text.length,
      sourceLanguage: guessLanguage(text),
      processingStatus: text.trim() ? (material.processingStatus === "unsupported" ? "partial" : "ready") : material.processingStatus,
    });
    toast.success(t.save);
  };

  const regenerate = () => {
    const chunks = createChunksFromText(text);
    store.replaceMaterialChunksForMaterial(material.id, chunks);
    toast.success(t.regenerateChunks);
  };

  const clear = () => {
    if (!confirm(t.clearRawTextConfirm)) return;
    setText("");
    store.updateMaterial(material.id, { rawText: "", wordCount: 0, charCount: 0 });
  };

  return (
    <div className="space-y-3">
      {material.processingStatus === "unsupported" && (
        <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
          {material.processingMessage || t.materialUnsupportedPaste}
        </div>
      )}
      {material.processingStatus === "no_text" && (
        <div className="rounded border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-200">
          {t.materialNoTextExtracted}
        </div>
      )}
      <textarea
        className="w-full min-h-[480px] rounded-md border border-input bg-background p-3 text-sm font-mono"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.materialUnsupportedPaste}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!dirty}>{t.save}</Button>
        <Button variant="outline" onClick={regenerate}>
          <RefreshCw className="h-4 w-4 me-1" />{t.regenerateChunks}
        </Button>
        <Button variant="ghost" onClick={clear}>
          <Trash2 className="h-4 w-4 me-1" />{t.clearRawText}
        </Button>
        <div className="ms-auto text-xs text-muted-foreground self-center">
          {t.wordCount}: {countWords(text)} · {t.charCount}: {text.length}
        </div>
      </div>
    </div>
  );
}

// ============ Chunks ============

function ChunksTab({ material, chunks }: { material: Material; chunks: MaterialChunk[] }) {
  const { t } = useApp();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return chunks;
    return chunks.filter((c) => c.text.toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q));
  }, [chunks, query]);

  const addManual = () => {
    const nextOrder = chunks.length;
    store.createMaterialChunk({ materialId: material.id, order: nextOrder, title: `Chunk ${nextOrder + 1}`, text: "" });
    toast.success(t.chunkAddedManually);
  };

  const regenerate = () => {
    const next = createChunksFromText(material.rawText);
    store.replaceMaterialChunksForMaterial(material.id, next);
    toast.success(t.regenerateChunks);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-8" placeholder={t.searchInChunks} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button variant="outline" onClick={regenerate}><RefreshCw className="h-4 w-4 me-1" />{t.regenerateChunks}</Button>
        <Button onClick={addManual}><Plus className="h-4 w-4 me-1" />{t.addChunk}</Button>
      </div>
      {chunks.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
          {t.chunksEmpty}
        </div>
      )}
      <div className="space-y-2">
        {filtered.map((ch) => (
          <ChunkRow key={ch.id} chunk={ch} />
        ))}
      </div>
    </div>
  );
}

function ChunkRow({ chunk }: { chunk: MaterialChunk }) {
  const { t } = useApp();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(chunk.text);
  const [title, setTitle] = useState(chunk.title ?? "");

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="font-mono">#{chunk.order + 1}</span>
          {chunk.pageNumber && <span>· p.{chunk.pageNumber}</span>}
          {chunk.section && <span>· {chunk.section}</span>}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)}>
            {editing ? t.close : t.edit}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => { if (confirm(t.confirm + "?")) store.deleteMaterialChunk(chunk.id); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.title} />
          <textarea
            className="w-full min-h-[180px] rounded-md border border-input bg-background p-2 text-sm font-mono"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button size="sm" onClick={() => { store.updateMaterialChunk(chunk.id, { title: title || undefined, text }); setEditing(false); toast.success(t.save); }}>
            {t.save}
          </Button>
        </div>
      ) : (
        <>
          {chunk.title && <div className="text-sm font-semibold mt-1">{chunk.title}</div>}
          <pre className="mt-1 text-xs whitespace-pre-wrap font-mono text-muted-foreground max-h-64 overflow-auto">
            {chunk.text}
          </pre>
        </>
      )}
    </div>
  );
}

// ============ Study Builder ============

function StudyBuilderTab({ material, chunks }: { material: Material; chunks: MaterialChunk[] }) {
  const { t } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(chunks[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const selected = chunks.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return chunks;
    return chunks.filter((c) => c.text.toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q));
  }, [chunks, query]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      <div className="rounded-lg border border-border bg-surface p-3 space-y-2 min-h-[500px]">
        <div className="relative">
          <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-8" placeholder={t.searchInChunks} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {chunks.length === 0 ? (
          <div className="text-sm text-muted-foreground p-6 text-center">{t.chunksEmpty}</div>
        ) : (
          <div className="space-y-1 overflow-auto max-h-[560px]">
            {filtered.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedId(ch.id)}
                className={`w-full text-left rounded-md border p-2 text-xs ${selectedId === ch.id ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"}`}
              >
                <div className="font-semibold truncate">{ch.title || `Chunk ${ch.order + 1}`}</div>
                <div className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">{ch.text}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {selected ? (
          <BuilderActions material={material} chunk={selected} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground text-center">
            {t.selectionEmpty}
          </div>
        )}
      </div>
    </div>
  );
}

function BuilderActions({ material, chunk }: { material: Material; chunk: MaterialChunk }) {
  const { t } = useApp();
  const [mode, setMode] = useState<"note" | "card" | "quiz" | "assignment" | "slide">("note");
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={mode === "note" ? "default" : "outline"} onClick={() => setMode("note")}><StickyNote className="h-3.5 w-3.5 me-1" />{t.createNoteFromChunk}</Button>
        <Button size="sm" variant={mode === "card" ? "default" : "outline"} onClick={() => setMode("card")}><Layers className="h-3.5 w-3.5 me-1" />{t.createCardFromChunk}</Button>
        <Button size="sm" variant={mode === "quiz" ? "default" : "outline"} onClick={() => setMode("quiz")}><HelpCircle className="h-3.5 w-3.5 me-1" />{t.createQuestionFromChunk}</Button>
        <Button size="sm" variant={mode === "assignment" ? "default" : "outline"} onClick={() => setMode("assignment")}><ClipboardList className="h-3.5 w-3.5 me-1" />{t.createAssignmentNoteFromChunk}</Button>
        <Button size="sm" variant={mode === "slide" ? "default" : "outline"} onClick={() => setMode("slide")}><Presentation className="h-3.5 w-3.5 me-1" />{t.createSlideFromChunk}</Button>
      </div>
      {mode === "note" && <CreateNoteFromChunk material={material} chunk={chunk} />}
      {mode === "card" && <CreateCardFromChunk material={material} chunk={chunk} />}
      {mode === "quiz" && <CreateQuestionFromChunk material={material} chunk={chunk} />}
      {mode === "assignment" && <CreateAssignmentFromChunk material={material} chunk={chunk} />}
      {mode === "slide" && <CreateSlideFromChunk material={material} chunk={chunk} />}
    </div>
  );
}

function CreateNoteFromChunk({ material, chunk }: { material: Material; chunk: MaterialChunk }) {
  const { t } = useApp();
  const [title, setTitle] = useState(chunk.title || material.title);
  const [content, setContent] = useState(chunk.text);
  const save = () => {
    const n = store.createNote({
      title, content, tags: [],
      courseId: material.courseId, topicId: material.topicId, materialId: material.id,
      sourceChunkIds: [chunk.id],
    });
    store.recordOutput({ materialId: material.id, type: "note", linkedEntityId: n.id });
    toast.success(t.save);
  };
  return (
    <div className="space-y-2">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.title} />
      <textarea className="w-full min-h-[280px] rounded-md border border-input bg-background p-2 text-sm font-mono" value={content} onChange={(e) => setContent(e.target.value)} />
      <Button onClick={save} disabled={!content.trim()}>{t.save}</Button>
    </div>
  );
}

function CreateCardFromChunk({ material, chunk }: { material: Material; chunk: MaterialChunk }) {
  const { t } = useApp();
  const [front, setFront] = useState(chunk.title || "");
  const [back, setBack] = useState(chunk.text);
  const save = () => {
    store.createCard({
      front: front.trim(), back: back.trim(),
      courseId: material.courseId, topicId: material.topicId, materialId: material.id,
      sourceChunkIds: [chunk.id],
    });
    store.recordOutput({ materialId: material.id, type: "flashcards" });
    toast.success(t.save);
  };
  return (
    <div className="space-y-2">
      <div><Label>{t.front}</Label><Input value={front} onChange={(e) => setFront(e.target.value)} /></div>
      <div><Label>{t.cardBack}</Label>
        <textarea className="w-full min-h-[180px] rounded-md border border-input bg-background p-2 text-sm" value={back} onChange={(e) => setBack(e.target.value)} />
      </div>
      <Button onClick={save} disabled={!front.trim() || !back.trim()}>{t.save}</Button>
    </div>
  );
}

function CreateQuestionFromChunk({ material, chunk }: { material: Material; chunk: MaterialChunk }) {
  const { t } = useApp();
  const data = useData();
  const [quizId, setQuizId] = useState<string | null>(() => data.quizzes.find((q) => q.materialId === material.id)?.id ?? null);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState(chunk.text.slice(0, 200));

  const ensureQuiz = () => {
    if (quizId) return quizId;
    const q = store.createQuiz({ title: `${material.title} — quiz`, courseId: material.courseId, topicId: material.topicId, materialId: material.id });
    store.recordOutput({ materialId: material.id, type: "quiz", linkedEntityId: q.id });
    setQuizId(q.id);
    return q.id;
  };

  const add = () => {
    if (!prompt.trim() || options.filter((o) => o.trim()).length < 2) return;
    const id = ensureQuiz();
    store.addQuestion({
      quizId: id, prompt: prompt.trim(),
      options: options.map((o) => o.trim()).filter(Boolean),
      correctIndex: correct,
      explanation: explanation.trim() || undefined,
      sourceChunkIds: [chunk.id],
    });
    setPrompt(""); setOptions(["", ""]); setCorrect(0); setExplanation("");
    toast.success(t.save);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground border-b border-border pb-2 max-h-32 overflow-auto whitespace-pre-wrap">{chunk.text}</div>
      <div><Label>{t.question}</Label><Input value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div>
      <div className="space-y-1">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => setCorrect(i)}
              className={`h-5 w-5 rounded-full border flex items-center justify-center ${correct === i ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}
              title={t.correct}
            >
              {correct === i && <Check className="h-3 w-3" />}
            </button>
            <Input value={opt} onChange={(e) => { const next = [...options]; next[i] = e.target.value; setOptions(next); }} />
            <Button size="icon" variant="ghost" onClick={() => {
              if (options.length <= 2) return;
              const next = options.filter((_, ix) => ix !== i);
              setOptions(next); setCorrect(Math.min(correct, next.length - 1));
            }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setOptions([...options, ""])}><Plus className="h-3.5 w-3.5 me-1" />{t.add}</Button>
      </div>
      <div><Label>{t.explanation}</Label>
        <textarea className="w-full min-h-[70px] rounded-md border border-input bg-background p-2 text-sm" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </div>
      <Button onClick={add}>{t.addQuestion}</Button>
    </div>
  );
}

function CreateAssignmentFromChunk({ material, chunk }: { material: Material; chunk: MaterialChunk }) {
  const { t } = useApp();
  const [title, setTitle] = useState(chunk.title || material.title);
  const [notes, setNotes] = useState(chunk.text);
  const save = () => {
    store.createAssignment({
      title,
      courseId: material.courseId,
      status: "not_started",
      priority: "medium",
      notes,
    });
    toast.success(t.save);
  };
  return (
    <div className="space-y-2">
      <div><Label>{t.title}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><Label>{t.notes}</Label>
        <textarea className="w-full min-h-[200px] rounded-md border border-input bg-background p-2 text-sm font-mono" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button onClick={save} disabled={!title.trim()}>{t.save}</Button>
    </div>
  );
}

function CreateSlideFromChunk({ material, chunk }: { material: Material; chunk: MaterialChunk }) {
  const { t } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const [outlineId, setOutlineId] = useState<string | null>(() => data.presentationOutlines.find((o) => o.materialId === material.id)?.id ?? null);
  const [title, setTitle] = useState(chunk.title || "New slide");
  const [bullets, setBullets] = useState(chunk.text.split(/\n+/).slice(0, 6).join("\n"));

  const save = () => {
    let id = outlineId;
    if (!id) {
      const o = store.createOutline({
        title: `${material.title} — outline`,
        courseId: material.courseId, topicId: material.topicId, materialId: material.id,
      });
      store.recordOutput({ materialId: material.id, type: "presentation_outline", linkedEntityId: o.id });
      id = o.id;
      setOutlineId(id);
    }
    store.addSlide(id);
    // Find the newly added slide (last) and populate
    const state = data.presentationOutlines.find((o) => o.id === id);
    const next = state ? state.slides.length : 0;
    // Refetch after tick isn't necessary; addSlide already added. Now update the last:
    const outline = data.presentationOutlines.find((o) => o.id === id);
    const slideId = outline?.slides[next]?.id;
    // Fallback: update ephemeral last chunk via search after update through store
    if (slideId) {
      store.updateSlide(id, slideId, {
        title, bullets: bullets.split(/\n+/).map((s) => s.trim()).filter(Boolean),
        sourceQuote: chunk.text.slice(0, 240),
        sourceChunkIds: [chunk.id],
      });
    }
    toast.success(t.save);
    navigate({ to: "/app/presentations/$outlineId", params: { outlineId: id } });
  };

  return (
    <div className="space-y-2">
      <div><Label>{t.title}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><Label>{t.bullets}</Label>
        <textarea className="w-full min-h-[180px] rounded-md border border-input bg-background p-2 text-sm font-mono" value={bullets} onChange={(e) => setBullets(e.target.value)} />
      </div>
      <Button onClick={save} disabled={!title.trim()}>{t.save}</Button>
    </div>
  );
}

// ============ Outputs ============

function OutputsTab({ materialId }: { materialId: string }) {
  const { t } = useApp();
  const data = useData();
  const notes = data.notes.filter((n) => n.materialId === materialId);
  const cards = data.flashcards.filter((c) => c.materialId === materialId);
  const quizzes = data.quizzes.filter((q) => q.materialId === materialId);
  const outlines = data.presentationOutlines.filter((p) => p.materialId === materialId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Section title={t.notes} count={notes.length} icon={FileText}>
        {notes.map((n) => (
          <Link key={n.id} to="/app/notes" className="block text-sm hover:underline truncate">{n.title || "—"}</Link>
        ))}
      </Section>
      <Section title={t.flashcards} count={cards.length} icon={Layers}>
        {cards.slice(0, 20).map((c) => (
          <div key={c.id} className="text-sm truncate">{c.front}</div>
        ))}
      </Section>
      <Section title={t.quizzes} count={quizzes.length} icon={HelpCircle}>
        {quizzes.map((q) => (
          <Link key={q.id} to="/app/quizzes/$quizId" params={{ quizId: q.id }} className="block text-sm hover:underline truncate">{q.title}</Link>
        ))}
      </Section>
      <Section title={t.presentations} count={outlines.length} icon={Presentation}>
        {outlines.map((o) => (
          <Link key={o.id} to="/app/presentations/$outlineId" params={{ outlineId: o.id }} className="block text-sm hover:underline truncate">{o.title}</Link>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, count, icon: Icon, children }: { title: string; count: number; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold flex items-center gap-2"><Icon className="h-4 w-4" />{title}</div>
        <div className="text-lg font-bold">{count}</div>
      </div>
      <div className="space-y-1 max-h-64 overflow-auto">
        {count === 0 ? <div className="text-xs text-muted-foreground">—</div> : children}
      </div>
    </div>
  );
}
