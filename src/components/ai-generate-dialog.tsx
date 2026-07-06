import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AIDraftModal, type AIDraftState, type AIDraftSource } from "@/components/ai-draft-modal";
import { useApp } from "@/lib/app-context";
import { useData, store, getChunksByMaterial, type MaterialChunk } from "@/lib/store";
import {
  checkAIStatus,
  generateNoteDraft,
  generateFlashcardsDraft,
  generateQuizDraft,
  generatePresentationOutlineDraft,
  type AIChunkInput,
  type NoteDraft,
  type FlashcardsDraft,
  type QuizDraft,
  type PresentationDraft,
} from "@/lib/ai";
import { Sparkles, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export type AIGenerateKind = "note" | "flashcards" | "quiz" | "presentation";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: AIGenerateKind;
  initialMaterialId?: string;
  initialCourseId?: string;
  initialTopicId?: string;
  initialChunkIds?: string[];
}

const MAX_CHUNKS = 8;

export function AIGenerateDialog(props: Props) {
  const { t, lang } = useApp();
  const data = useData();
  const [materialId, setMaterialId] = useState<string>(props.initialMaterialId ?? "");
  const [selected, setSelected] = useState<string[]>(props.initialChunkIds ?? []);
  const [instructions, setInstructions] = useState("");
  const [state, setState] = useState<AIDraftState>("idle");
  const [error, setError] = useState<string>("");
  const [note, setNote] = useState<NoteDraft | null>(null);
  const [cards, setCards] = useState<FlashcardsDraft | null>(null);
  const [quiz, setQuiz] = useState<QuizDraft | null>(null);
  const [pres, setPres] = useState<PresentationDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (props.open) checkAIStatus().then((s) => setAiConfigured(s.configured));
  }, [props.open]);

  useEffect(() => {
    if (props.open) {
      setMaterialId(props.initialMaterialId ?? "");
      setSelected(props.initialChunkIds ?? []);
      setInstructions("");
      setState("idle");
      setError("");
      setNote(null); setCards(null); setQuiz(null); setPres(null);
      setWarnings([]);
    }
  }, [props.open, props.initialMaterialId, props.initialChunkIds]);

  const material = data.materials.find((m) => m.id === materialId) ?? null;
  const chunks: MaterialChunk[] = material ? getChunksByMaterial(data, material.id) : [];
  const selectedChunks = chunks.filter((c) => selected.includes(c.id));
  const totalChars = selectedChunks.reduce((n, c) => n + c.text.length, 0);
  const overLimit = totalChars > 20_000;
  const course = data.courses.find((c) => c.id === (props.initialCourseId ?? material?.courseId));
  const topic = data.topics.find((tp) => tp.id === (props.initialTopicId ?? material?.topicId));

  const toggleChunk = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_CHUNKS) return prev;
      return [...prev, id];
    });
  };

  const inputPayload = () => ({
    locale: lang,
    targetLanguage: lang,
    course: course ? { id: course.id, title: course.title, number: course.number } : undefined,
    topic: topic ? { id: topic.id, title: topic.title } : undefined,
    material: material ? { id: material.id, title: material.title, type: material.type } : undefined,
    chunks: selectedChunks.map<AIChunkInput>((c) => ({
      id: c.id, title: c.title, text: c.text, pageNumber: c.pageNumber, section: c.section,
    })),
    instructions: instructions.trim() || undefined,
  });

  const generate = async () => {
    if (selected.length === 0) { toast.error(t.aiNoChunksSelected); return; }
    if (overLimit) { toast.error(t.aiTooManyChars); return; }
    setState("loading"); setError(""); setWarnings([]);
    const input = inputPayload();
    if (props.kind === "note") {
      const r = await generateNoteDraft(input);
      if (r.ok) { setNote(r.data); setWarnings(r.data.warnings ?? []); setState("ready"); }
      else { setError(r.message); setState("error"); }
    } else if (props.kind === "flashcards") {
      const r = await generateFlashcardsDraft(input);
      if (r.ok) { setCards(r.data); setWarnings(r.data.warnings ?? []); setState("ready"); }
      else { setError(r.message); setState("error"); }
    } else if (props.kind === "quiz") {
      const r = await generateQuizDraft(input);
      if (r.ok) { setQuiz(r.data); setWarnings(r.data.warnings ?? []); setState("ready"); }
      else { setError(r.message); setState("error"); }
    } else {
      const r = await generatePresentationOutlineDraft(input);
      if (r.ok) { setPres(r.data); setWarnings(r.data.warnings ?? []); setState("ready"); }
      else { setError(r.message); setState("error"); }
    }
  };

  const chunkSources: AIDraftSource[] = selectedChunks.map((c) => ({
    id: c.id, title: c.title || `Chunk ${c.order + 1}`,
  }));

  const save = () => {
    if (!material) return;
    const ctx = {
      courseId: material.courseId,
      topicId: material.topicId,
      materialId: material.id,
    };
    if (props.kind === "note" && note) {
      const n = store.createNote({
        title: note.title || material.title,
        content: note.content,
        tags: note.tags ?? [],
        ...ctx,
        sourceChunkIds: selected,
      });
      store.recordOutput({ materialId: material.id, type: "note", linkedEntityId: n.id });
      toast.success(t.save);
    } else if (props.kind === "flashcards" && cards) {
      for (const c of cards.cards) {
        store.createCard({
          front: c.front, back: c.back, ...ctx,
          sourceChunkIds: c.sourceChunkIds?.length ? c.sourceChunkIds : selected,
        });
      }
      store.recordOutput({ materialId: material.id, type: "flashcards" });
      toast.success(`${cards.cards.length} · ${t.save}`);
    } else if (props.kind === "quiz" && quiz) {
      const q = store.createQuiz({ title: quiz.title || `${material.title} — quiz`, ...ctx });
      for (const qq of quiz.questions) {
        store.addQuestion({
          quizId: q.id, prompt: qq.prompt, options: qq.options,
          correctIndex: qq.correctIndex, explanation: qq.explanation || undefined,
          sourceChunkIds: qq.sourceChunkIds?.length ? qq.sourceChunkIds : selected,
        });
      }
      store.recordOutput({ materialId: material.id, type: "quiz", linkedEntityId: q.id });
      toast.success(t.save);
    } else if (props.kind === "presentation" && pres) {
      const outline = store.createOutline({
        title: pres.title || material.title, ...ctx,
        slides: pres.slides.map((s, i) => ({
          id: `sl_${Date.now()}_${i}`,
          title: s.title, bullets: s.bullets, speakerNotes: s.speakerNotes,
          sourceChunkIds: s.sourceChunkIds?.length ? s.sourceChunkIds : selected,
          order: i,
        })),
      });
      store.recordOutput({ materialId: material.id, type: "presentation_outline", linkedEntityId: outline.id });
      toast.success(t.save);
    }
    props.onOpenChange(false);
  };

  const title =
    props.kind === "note" ? t.aiGenerateNote :
    props.kind === "flashcards" ? t.aiGenerateFlashcards :
    props.kind === "quiz" ? t.aiGenerateQuiz :
    t.aiGeneratePresentation;

  const editor = state === "ready" ? (
    <div className="space-y-3">
      {props.kind === "note" && note && <NoteEditor draft={note} onChange={setNote} />}
      {props.kind === "flashcards" && cards && <CardsEditor draft={cards} onChange={setCards} />}
      {props.kind === "quiz" && quiz && <QuizEditor draft={quiz} onChange={setQuiz} />}
      {props.kind === "presentation" && pres && <PresEditor draft={pres} onChange={setPres} />}
    </div>
  ) : null;

  return (
    <AIDraftModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      state={state}
      error={error}
      warnings={warnings}
      sourceChunks={state === "ready" ? chunkSources : undefined}
      onSave={save}
      onRegenerate={selected.length > 0 ? generate : undefined}
    >
      {state === "idle" && (
        <div className="space-y-3">
          {aiConfigured === false && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs">{t.aiUnavailable}</div>
          )}
          <div>
            <Label>{t.aiChooseMaterial}</Label>
            <Select value={materialId} onValueChange={(v) => { setMaterialId(v); setSelected([]); }}>
              <SelectTrigger><SelectValue placeholder={t.aiSelectSource} /></SelectTrigger>
              <SelectContent>
                {data.materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {material && (
            <div>
              <Label>{t.aiSelectChunks}</Label>
              <div className="max-h-72 overflow-auto rounded-md border border-border bg-background p-1 space-y-1">
                {chunks.length === 0 && (
                  <div className="p-4 text-xs text-muted-foreground text-center">{t.chunksEmpty}</div>
                )}
                {chunks.map((c) => (
                  <label key={c.id} className={`flex gap-2 p-2 rounded-md text-xs cursor-pointer ${selected.includes(c.id) ? "bg-primary/10 border border-primary/40" : "hover:bg-surface"}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.includes(c.id)}
                      onChange={() => toggleChunk(c.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{c.title || `Chunk ${c.order + 1}`}</div>
                      <div className="text-muted-foreground line-clamp-2 whitespace-pre-wrap">{c.text}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {selected.length}/{MAX_CHUNKS} · {totalChars} / 20000
              </div>
              {overLimit && <div className="text-[11px] text-destructive">{t.aiTooManyChars}</div>}
            </div>
          )}
          <div>
            <Label>{t.aiInstructionsOptional}</Label>
            <textarea
              className="w-full min-h-16 rounded-md border border-input bg-background p-2 text-sm"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={generate}
              disabled={!aiConfigured || selected.length === 0 || overLimit}
              title={!aiConfigured ? t.aiUnavailable : selected.length === 0 ? t.aiNoChunksSelected : undefined}
            >
              <Sparkles className="h-4 w-4 me-1" />{t.aiGenerate}
            </Button>
          </div>
        </div>
      )}
      {editor}
    </AIDraftModal>
  );
}

// ============ Editors ============

function NoteEditor({ draft, onChange }: { draft: NoteDraft; onChange: (d: NoteDraft) => void }) {
  const { t } = useApp();
  return (
    <div className="space-y-2">
      <div><Label>{t.title}</Label><Input value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} /></div>
      <div>
        <Label>{t.content ?? "Content"}</Label>
        <textarea className="w-full min-h-[280px] rounded-md border border-input bg-background p-2 text-sm font-mono" value={draft.content} onChange={(e) => onChange({ ...draft, content: e.target.value })} />
      </div>
      <div><Label>{t.tags}</Label>
        <Input value={draft.tags.join(", ")} onChange={(e) => onChange({ ...draft, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </div>
    </div>
  );
}

function CardsEditor({ draft, onChange }: { draft: FlashcardsDraft; onChange: (d: FlashcardsDraft) => void }) {
  const { t } = useApp();
  const update = (i: number, patch: Partial<FlashcardsDraft["cards"][number]>) => {
    onChange({ ...draft, cards: draft.cards.map((c, ix) => (ix === i ? { ...c, ...patch } : c)) });
  };
  const remove = (i: number) => onChange({ ...draft, cards: draft.cards.filter((_, ix) => ix !== i) });
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{draft.cards.length} · {t.flashcards}</div>
      {draft.cards.map((c, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-2 space-y-1">
          <div className="flex gap-2">
            <Input value={c.front} onChange={(e) => update(i, { front: e.target.value })} placeholder={t.front} />
            <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          <textarea className="w-full min-h-[60px] rounded-md border border-input bg-background p-2 text-sm" value={c.back} onChange={(e) => update(i, { back: e.target.value })} placeholder={t.cardBack} />
        </div>
      ))}
    </div>
  );
}

function QuizEditor({ draft, onChange }: { draft: QuizDraft; onChange: (d: QuizDraft) => void }) {
  const { t } = useApp();
  const updateQ = (i: number, patch: Partial<QuizDraft["questions"][number]>) => {
    onChange({ ...draft, questions: draft.questions.map((q, ix) => (ix === i ? { ...q, ...patch } : q)) });
  };
  const remove = (i: number) => onChange({ ...draft, questions: draft.questions.filter((_, ix) => ix !== i) });
  return (
    <div className="space-y-2">
      <div><Label>{t.title}</Label><Input value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} /></div>
      {draft.questions.map((q, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-2 space-y-1">
          <div className="flex gap-2">
            <Input value={q.prompt} onChange={(e) => updateQ(i, { prompt: e.target.value })} placeholder={t.question} />
            <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          {q.options.map((opt, j) => (
            <div key={j} className="flex items-center gap-2 text-xs">
              <input type="radio" checked={q.correctIndex === j} onChange={() => updateQ(i, { correctIndex: j })} />
              <Input value={opt} onChange={(e) => { const opts = [...q.options]; opts[j] = e.target.value; updateQ(i, { options: opts }); }} />
            </div>
          ))}
          <textarea className="w-full min-h-[50px] rounded-md border border-input bg-background p-2 text-xs" value={q.explanation} onChange={(e) => updateQ(i, { explanation: e.target.value })} placeholder={t.explanation} />
        </div>
      ))}
    </div>
  );
}

function PresEditor({ draft, onChange }: { draft: PresentationDraft; onChange: (d: PresentationDraft) => void }) {
  const { t } = useApp();
  const updateS = (i: number, patch: Partial<PresentationDraft["slides"][number]>) =>
    onChange({ ...draft, slides: draft.slides.map((s, ix) => (ix === i ? { ...s, ...patch } : s)) });
  const remove = (i: number) => onChange({ ...draft, slides: draft.slides.filter((_, ix) => ix !== i) });
  return (
    <div className="space-y-2">
      <div><Label>{t.title}</Label><Input value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} /></div>
      {draft.slides.map((s, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-2 space-y-1">
          <div className="flex gap-2">
            <Input value={s.title} onChange={(e) => updateS(i, { title: e.target.value })} />
            <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          <textarea
            className="w-full min-h-[60px] rounded-md border border-input bg-background p-2 text-xs"
            value={s.bullets.join("\n")}
            onChange={(e) => updateS(i, { bullets: e.target.value.split("\n") })}
          />
          <textarea
            className="w-full min-h-[40px] rounded-md border border-input bg-background p-2 text-xs"
            value={s.speakerNotes}
            onChange={(e) => updateS(i, { speakerNotes: e.target.value })}
            placeholder={t.speakerNotes ?? "Speaker notes"}
          />
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange({ ...draft, slides: [...draft.slides, { title: "New slide", bullets: [], speakerNotes: "", sourceChunkIds: [] }] })}>
        <Plus className="h-3.5 w-3.5 me-1" />{t.add ?? "Add"}
      </Button>
    </div>
  );
}

// ============ Convenience button ============

export function AIGenerateButton(props: {
  kind: AIGenerateKind;
  initialMaterialId?: string;
  initialCourseId?: string;
  initialTopicId?: string;
  initialChunkIds?: string[];
  size?: "default" | "sm";
  variant?: "default" | "outline";
  className?: string;
  label?: string;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => { checkAIStatus().then((s) => setConfigured(s.configured)); }, []);
  const label = props.label ??
    (props.kind === "note" ? t.aiGenerateNote :
     props.kind === "flashcards" ? t.aiGenerateFlashcards :
     props.kind === "quiz" ? t.aiGenerateQuiz : t.aiGeneratePresentation);
  return (
    <>
      <Button
        size={props.size}
        variant={props.variant ?? "outline"}
        onClick={() => setOpen(true)}
        disabled={configured === false}
        title={configured === false ? t.aiUnavailable : undefined}
        className={props.className}
      >
        <Sparkles className="h-4 w-4 me-1" />{label}
      </Button>
      <AIGenerateDialog
        open={open}
        onOpenChange={setOpen}
        kind={props.kind}
        initialMaterialId={props.initialMaterialId}
        initialCourseId={props.initialCourseId}
        initialTopicId={props.initialTopicId}
        initialChunkIds={props.initialChunkIds}
      />
    </>
  );
}
