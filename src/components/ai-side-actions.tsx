import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AIDraftModal, type AIDraftState } from "@/components/ai-draft-modal";
import { useApp } from "@/lib/app-context";
import { store, useData, getChunksByMaterial } from "@/lib/store";
import {
  checkAIStatus,
  generateAssignmentBreakdownDraft,
  generateTopicExplanationDraft,
  type AIChunkInput,
  type AssignmentBreakdownDraft,
  type TopicExplanationDraft,
} from "@/lib/ai";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

// ============ Assignment breakdown ============

export function AIAssignmentBreakdownButton({
  assignmentId,
}: { assignmentId: string }) {
  const { t, lang } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AIDraftState>("idle");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<AssignmentBreakdownDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  useEffect(() => { checkAIStatus().then((s) => setAiConfigured(s.configured)); }, []);
  const a = data.assignments.find((x) => x.id === assignmentId);
  if (!a) return null;

  const generate = async () => {
    setState("loading"); setError(""); setDraft(null); setWarnings([]);
    const course = data.courses.find((c) => c.id === a.courseId);
    const r = await generateAssignmentBreakdownDraft({
      locale: lang, targetLanguage: lang,
      assignmentTitle: a.title, assignmentNotes: a.notes,
      course: course ? { id: course.id, title: course.title, number: course.number } : undefined,
    });
    if (r.ok) { setDraft(r.data); setWarnings(r.data.warnings ?? []); setState("ready"); }
    else { setError(r.message); setState("error"); }
  };

  const append = () => {
    if (!draft) return;
    const block = [
      `\n\n--- ${t.aiBreakDownAssignment} ---`,
      draft.estimatedTime && `${t.aiEstimatedTime}: ${draft.estimatedTime}`,
      draft.steps.length ? `\n${t.aiSteps}:\n` + draft.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "",
      draft.checklist.length ? `\n${t.aiChecklist}:\n` + draft.checklist.map((s) => `[ ] ${s}`).join("\n") : "",
    ].filter(Boolean).join("\n");
    store.updateAssignment(a.id, { notes: (a.notes ?? "") + block });
    toast.success(t.save);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); }} disabled={aiConfigured === false} title={aiConfigured === false ? t.aiUnavailable : undefined}>
        <Sparkles className="h-4 w-4 me-1" />{t.aiBreakDownAssignment}
      </Button>
      <AIDraftModal
        open={open}
        onOpenChange={setOpen}
        title={t.aiBreakDownAssignment}
        state={state}
        error={error}
        warnings={warnings}
        onSave={draft ? append : undefined}
        onRegenerate={state !== "idle" ? generate : undefined}
        copyText={draft ? [
          draft.estimatedTime && `${t.aiEstimatedTime}: ${draft.estimatedTime}`,
          ...draft.steps.map((s, i) => `${i + 1}. ${s}`),
          "",
          ...draft.checklist.map((s) => `[ ] ${s}`),
        ].filter(Boolean).join("\n") : undefined}
      >
        {state === "idle" && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{a.title}</div>
            <Button onClick={generate} disabled={!aiConfigured}>
              <Sparkles className="h-4 w-4 me-1" />{t.aiGenerate}
            </Button>
          </div>
        )}
        {state === "ready" && draft && (
          <div className="space-y-3">
            <div><Label>{t.aiEstimatedTime}</Label>
              <Input value={draft.estimatedTime} onChange={(e) => setDraft({ ...draft, estimatedTime: e.target.value })} />
            </div>
            <div><Label>{t.aiSteps}</Label>
              <textarea
                className="w-full min-h-[140px] rounded-md border border-input bg-background p-2 text-sm font-mono"
                value={draft.steps.join("\n")}
                onChange={(e) => setDraft({ ...draft, steps: e.target.value.split("\n") })}
              />
            </div>
            <div><Label>{t.aiChecklist}</Label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background p-2 text-sm font-mono"
                value={draft.checklist.join("\n")}
                onChange={(e) => setDraft({ ...draft, checklist: e.target.value.split("\n") })}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">{t.aiAppendToNotes}</div>
          </div>
        )}
      </AIDraftModal>
    </>
  );
}

// ============ Topic explanation ============

export function AITopicExplainButton({
  topicId, courseId, materialId,
}: { topicId?: string; courseId?: string; materialId?: string }) {
  const { t, lang } = useApp();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AIDraftState>("idle");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<TopicExplanationDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  useEffect(() => { checkAIStatus().then((s) => setAiConfigured(s.configured)); }, []);

  const topic = topicId ? data.topics.find((x) => x.id === topicId) : undefined;
  const course = courseId ? data.courses.find((x) => x.id === courseId) : undefined;
  const material = materialId ? data.materials.find((x) => x.id === materialId) : undefined;

  // Gather up to 6 chunks from related material (if any) or first material of course:
  const collectChunks = (): AIChunkInput[] => {
    let mats = data.materials.filter((m) => (topic && m.topicId === topic.id) || (course && m.courseId === course.id));
    if (material) mats = [material, ...mats.filter((m) => m.id !== material.id)];
    const chunks: AIChunkInput[] = [];
    for (const m of mats.slice(0, 3)) {
      for (const c of getChunksByMaterial(data, m.id).slice(0, 3)) {
        chunks.push({ id: c.id, title: c.title, text: c.text, pageNumber: c.pageNumber, section: c.section });
        if (chunks.length >= 6) break;
      }
      if (chunks.length >= 6) break;
    }
    return chunks;
  };

  const generate = async () => {
    setState("loading"); setError(""); setDraft(null); setWarnings([]);
    const r = await generateTopicExplanationDraft({
      locale: lang, targetLanguage: lang,
      course: course ? { id: course.id, title: course.title, number: course.number } : undefined,
      topic: topic ? { id: topic.id, title: topic.title } : undefined,
      material: material ? { id: material.id, title: material.title, type: material.type } : undefined,
      chunks: collectChunks(),
    });
    if (r.ok) { setDraft(r.data); setWarnings(r.data.warnings ?? []); setState("ready"); }
    else { setError(r.message); setState("error"); }
  };

  const saveAsNote = () => {
    if (!draft) return;
    const title = topic?.title || course?.title || "Topic explanation";
    const content = [
      `## ${t.aiShortExplanation}`, draft.shortExplanation,
      `\n## ${t.aiDetailedExplanation}`, draft.detailedExplanation,
      draft.keyTerms.length ? `\n## ${t.aiKeyTerms}\n` + draft.keyTerms.map((k) => `- **${k.term}**: ${k.explanation}`).join("\n") : "",
    ].filter(Boolean).join("\n");
    store.createNote({
      title, content, tags: ["ai", "topic"],
      courseId: course?.id, topicId: topic?.id, materialId: material?.id,
    });
    toast.success(t.save);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={aiConfigured === false} title={aiConfigured === false ? t.aiUnavailable : undefined}>
        <Sparkles className="h-4 w-4 me-1" />{t.aiExplainTopic}
      </Button>
      <AIDraftModal
        open={open}
        onOpenChange={setOpen}
        title={t.aiExplainTopic}
        state={state}
        error={error}
        warnings={warnings}
        onSave={draft ? saveAsNote : undefined}
        onRegenerate={state !== "idle" ? generate : undefined}
        copyText={draft ? `${draft.shortExplanation}\n\n${draft.detailedExplanation}` : undefined}
      >
        {state === "idle" && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{topic?.title || course?.title}</div>
            <Button onClick={generate} disabled={!aiConfigured}>
              <Sparkles className="h-4 w-4 me-1" />{t.aiGenerate}
            </Button>
          </div>
        )}
        {state === "ready" && draft && (
          <div className="space-y-3">
            <div><Label>{t.aiShortExplanation}</Label>
              <textarea className="w-full min-h-[80px] rounded-md border border-input bg-background p-2 text-sm" value={draft.shortExplanation} onChange={(e) => setDraft({ ...draft, shortExplanation: e.target.value })} />
            </div>
            <div><Label>{t.aiDetailedExplanation}</Label>
              <textarea className="w-full min-h-[220px] rounded-md border border-input bg-background p-2 text-sm font-mono" value={draft.detailedExplanation} onChange={(e) => setDraft({ ...draft, detailedExplanation: e.target.value })} />
            </div>
            {draft.keyTerms.length > 0 && (
              <div>
                <Label>{t.aiKeyTerms}</Label>
                <div className="space-y-1">
                  {draft.keyTerms.map((k, i) => (
                    <div key={i} className="rounded-md border border-border bg-background p-2 text-xs">
                      <div className="font-semibold">{k.term}</div>
                      <div className="text-muted-foreground">{k.explanation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">{t.aiSaveAsNote}</div>
          </div>
        )}
      </AIDraftModal>
    </>
  );
}
