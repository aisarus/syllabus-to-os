import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/lib/app-context";
import { useData, store, type MaterialType } from "@/lib/store";
import { extractTermSuggestions, formatFileSize } from "@/lib/materials";
import { ArrowLeft, Plus, Trash2, Check, FileText, HelpCircle, Layers, Presentation } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/materials/$materialId")({
  component: MaterialDetail,
});

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
  const notesFromMat = data.notes.filter((n) => n.materialId === material.id);
  const cardsFromMat = data.flashcards.filter((c) => c.materialId === material.id);
  const quizzesFromMat = data.quizzes.filter((q) => q.materialId === material.id);
  const outlinesFromMat = data.presentationOutlines.filter((p) => p.materialId === material.id);

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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <Tabs defaultValue="text">
            <TabsList>
              <TabsTrigger value="text">{t.rawText}</TabsTrigger>
              <TabsTrigger value="note">{t.createNoteFromMaterial}</TabsTrigger>
              <TabsTrigger value="cards">{t.createFlashcardsFromMaterial}</TabsTrigger>
              <TabsTrigger value="quiz">{t.createQuizFromMaterial}</TabsTrigger>
              <TabsTrigger value="outline">{t.createOutlineFromMaterial}</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="space-y-3">
              {material.processingStatus === "unsupported" && (
                <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                  {t.processingUnsupported}
                </div>
              )}
              <textarea
                className="w-full min-h-[420px] rounded-md border border-input bg-background p-3 text-sm font-mono"
                value={material.rawText}
                onChange={(e) => store.updateMaterial(material.id, { rawText: e.target.value })}
                placeholder={material.processingStatus === "unsupported" ? "Paste extracted text here…" : ""}
              />
              <TermSuggestions materialId={material.id} text={material.rawText} />
            </TabsContent>

            <TabsContent value="note"><CreateNoteFromText material={material} /></TabsContent>
            <TabsContent value="cards"><CreateCardsFromText material={material} /></TabsContent>
            <TabsContent value="quiz"><CreateQuizFromText material={material} /></TabsContent>
            <TabsContent value="outline"><CreateOutlineFromMaterial material={material} /></TabsContent>
          </Tabs>
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
            {material.fileName && (
              <>
                <div className="text-muted-foreground uppercase text-[10px] mt-3">{t.fileMeta}</div>
                <div>{material.fileName}</div>
                <div className="text-muted-foreground">{material.mimeType || "—"} · {formatFileSize(material.fileSize)}</div>
              </>
            )}
          </div>

          <MiniList title={t.notes} count={notesFromMat.length} icon={FileText} />
          <MiniList title={t.flashcards} count={cardsFromMat.length} icon={Layers} />
          <MiniList title={t.quizzes} count={quizzesFromMat.length} icon={HelpCircle} />
          <MiniList title={t.presentations} count={outlinesFromMat.length} icon={Presentation} />

          <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
            {t.aiDisabledHint}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniList({ title, count, icon: Icon }: { title: string; count: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 flex items-center justify-between">
      <span className="text-sm flex items-center gap-2"><Icon className="h-4 w-4" />{title}</span>
      <span className="text-lg font-bold">{count}</span>
    </div>
  );
}

function TermSuggestions({ materialId, text }: { materialId: string; text: string }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => (open ? extractTermSuggestions(text) : []), [open, text]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const toggle = (term: string) => {
    const next = new Set(chosen);
    next.has(term) ? next.delete(term) : next.add(term);
    setChosen(next);
  };

  const createCards = () => {
    chosen.forEach((term) =>
      store.createCard({ front: term, back: "", materialId }),
    );
    store.recordOutput({ materialId, type: "flashcards" });
    toast.success(t.save);
    setChosen(new Set());
    setOpen(false);
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {t.extractTerms} <span className="text-xs text-muted-foreground">· {t.extractTermsHelp}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>{open ? t.close : t.open}</Button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          {suggestions.length === 0 ? (
            <div className="text-xs text-muted-foreground">{t.empty}</div>
          ) : (
            <>
              <div className="text-[10px] uppercase text-muted-foreground">{t.suggestions}</div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggle(s)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${chosen.has(s) ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Button size="sm" disabled={chosen.size === 0} onClick={createCards}>
                {t.createCard} ({chosen.size})
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CreateNoteFromText({ material }: { material: { id: string; title: string; rawText: string; courseId?: string; topicId?: string } }) {
  const { t } = useApp();
  const navigate = useNavigate();
  const [title, setTitle] = useState(material.title);
  const [content, setContent] = useState(material.rawText);

  const save = () => {
    const n = store.createNote({
      title,
      content,
      tags: [],
      courseId: material.courseId,
      topicId: material.topicId,
      materialId: material.id,
    });
    store.recordOutput({ materialId: material.id, type: "note", linkedEntityId: n.id });
    toast.success(t.save);
    navigate({ to: "/app/notes" });
  };

  return (
    <div className="space-y-3">
      <div><Label>{t.title}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><Label>{t.content}</Label>
        <textarea
          className="w-full min-h-[300px] rounded-md border border-input bg-background p-3 text-sm font-mono"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <Button onClick={save}>{t.save}</Button>
    </div>
  );
}

function CreateCardsFromText({ material }: { material: { id: string; rawText: string; courseId?: string; topicId?: string } }) {
  const { t } = useApp();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const created = useData().flashcards.filter((c) => c.materialId === material.id).length;

  const add = () => {
    if (!front.trim() || !back.trim()) return;
    store.createCard({
      front: front.trim(),
      back: back.trim(),
      courseId: material.courseId,
      topicId: material.topicId,
      materialId: material.id,
    });
    store.recordOutput({ materialId: material.id, type: "flashcards" });
    setFront(""); setBack("");
    toast.success(t.save);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <textarea
        className="w-full min-h-[420px] rounded-md border border-input bg-background p-3 text-sm font-mono"
        value={material.rawText}
        readOnly
      />
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">{created} {t.flashcards}</div>
        <div><Label>{t.front}</Label><Input value={front} onChange={(e) => setFront(e.target.value)} /></div>
        <div><Label>{t.cardBack}</Label>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background p-3 text-sm"
            value={back}
            onChange={(e) => setBack(e.target.value)}
          />
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 me-1" />{t.add}</Button>
      </div>
    </div>
  );
}

function CreateQuizFromText({ material }: { material: { id: string; title: string; rawText: string; courseId?: string; topicId?: string } }) {
  const { t } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const [quizId, setQuizId] = useState<string | null>(() => {
    return data.quizzes.find((q) => q.materialId === material.id)?.id ?? null;
  });
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");

  const ensureQuiz = () => {
    if (quizId) return quizId;
    const q = store.createQuiz({
      title: `${material.title} — quiz`,
      courseId: material.courseId,
      topicId: material.topicId,
      materialId: material.id,
    });
    store.recordOutput({ materialId: material.id, type: "quiz", linkedEntityId: q.id });
    setQuizId(q.id);
    return q.id;
  };

  const addQuestion = () => {
    if (!prompt.trim() || options.filter((o) => o.trim()).length < 2) return;
    const id = ensureQuiz();
    store.addQuestion({
      quizId: id,
      prompt: prompt.trim(),
      options: options.map((o) => o.trim()).filter(Boolean),
      correctIndex: correct,
      explanation: explanation.trim() || undefined,
    });
    setPrompt(""); setOptions(["", ""]); setCorrect(0); setExplanation("");
    toast.success(t.save);
  };

  const questions = quizId ? data.quizQuestions.filter((q) => q.quizId === quizId) : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <textarea
        className="w-full min-h-[420px] rounded-md border border-input bg-background p-3 text-sm font-mono"
        value={material.rawText}
        readOnly
      />
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">{questions.length} {t.addQuestion}</div>
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
              <Input
                value={opt}
                onChange={(e) => {
                  const next = [...options]; next[i] = e.target.value; setOptions(next);
                }}
              />
              <Button size="icon" variant="ghost" onClick={() => {
                if (options.length <= 2) return;
                const next = options.filter((_, ix) => ix !== i);
                setOptions(next);
                setCorrect(Math.min(correct, next.length - 1));
              }}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setOptions([...options, ""])}>
            <Plus className="h-3.5 w-3.5 me-1" />{t.add}
          </Button>
        </div>
        <div><Label>{t.explanation}</Label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background p-3 text-sm"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </div>
        <div className="flex justify-between">
          <Button onClick={addQuestion}><Plus className="h-4 w-4 me-1" />{t.addQuestion}</Button>
          {quizId && (
            <Button variant="outline" onClick={() => navigate({ to: "/app/quizzes/$quizId", params: { quizId } })}>
              {t.open}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateOutlineFromMaterial({ material }: { material: { id: string; title: string; courseId?: string; topicId?: string } }) {
  const { t } = useApp();
  const navigate = useNavigate();

  const create = () => {
    const outline = store.createOutline({
      title: `${material.title} — outline`,
      courseId: material.courseId,
      topicId: material.topicId,
      materialId: material.id,
    });
    store.recordOutput({ materialId: material.id, type: "presentation_outline", linkedEntityId: outline.id });
    navigate({ to: "/app/presentations/$outlineId", params: { outlineId: outline.id } });
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-6 space-y-3">
      <p className="text-sm text-muted-foreground">{t.createOutlineFromMaterial}. {t.aiDisabledHint}</p>
      <Button onClick={create}><Plus className="h-4 w-4 me-1" />{t.createOutline}</Button>
    </div>
  );
}
