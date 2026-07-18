import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AIDraftModal, type AIDraftState } from "@/components/ai-draft-modal";
import { StudyPackContinuation } from "@/components/study-pack-continuation";
import { StudyPackEditor } from "@/components/study-pack-editor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import {
  checkAIStatus,
  generateStudyPackDraft,
  type AIChunkInput,
  type StudyPackDraft,
} from "@/lib/ai";
import { studyPackCopyText, validateStudyPackDraft } from "@/lib/study-pack";
import { persistStudyPack, type PersistStudyPackResult } from "@/lib/study-pack-persistence";
import { getChunksByMaterial, useData } from "@/lib/store";

const MAX_CHUNKS = 8;
const MAX_CHARS = 20_000;

interface StudyPackButtonProps {
  materialId: string;
  courseId?: string;
  topicId?: string;
  initialChunkIds: string[];
  label?: string;
}

export function StudyPackButton(props: StudyPackButtonProps) {
  const { lang } = useApp();
  const [open, setOpen] = useState(false);
  const isRu = lang === "ru";

  return (
    <>
      <Button
        type="button"
        className="w-full justify-start"
        onClick={() => setOpen(true)}
        disabled={props.initialChunkIds.length === 0}
      >
        <BookOpenCheck className="h-4 w-4 me-2" />
        {props.label ?? (isRu ? "Подготовить меня по этой лекции" : "Prepare me from this lecture")}
      </Button>
      <StudyPackDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

function StudyPackDialog(
  props: StudyPackButtonProps & { open: boolean; onOpenChange: (open: boolean) => void },
) {
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const [state, setState] = useState<AIDraftState>("idle");
  const [error, setError] = useState("");
  const [instructions, setInstructions] = useState("");
  const [draft, setDraft] = useState<StudyPackDraft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [saveLocked, setSaveLocked] = useState(false);
  const [savedResult, setSavedResult] = useState<PersistStudyPackResult | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  const material = data.materials.find((item) => item.id === props.materialId) ?? null;
  const allChunks = material ? getChunksByMaterial(data, material.id) : [];
  const requestedChunks = allChunks.filter((chunk) => props.initialChunkIds.includes(chunk.id));
  const selectedChunks = requestedChunks.slice(0, MAX_CHUNKS);
  const totalChars = selectedChunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const course = data.courses.find((item) => item.id === (props.courseId ?? material?.courseId));
  const topic = data.topics.find((item) => item.id === (props.topicId ?? material?.topicId));
  const serialized = draft ? JSON.stringify(draft) : "";
  const dirty = state === "ready" && Boolean(baseline) && serialized !== baseline;
  const validationFailures = draft ? validateStudyPackDraft(draft) : ["draft"];
  const saveDisabled = saveLocked || validationFailures.length > 0;

  useEffect(() => {
    if (!props.open) return;
    setState("idle");
    setError("");
    setInstructions("");
    setDraft(null);
    setBaseline("");
    setSaveLocked(false);
    setSavedResult(null);
    void checkAIStatus().then((status) => setAiConfigured(status.configured));
  }, [props.open]);

  const sources = useMemo(
    () =>
      selectedChunks.map((chunk) => ({
        id: chunk.id,
        title: chunk.title || chunk.section || `${isRu ? "Фрагмент" : "Chunk"} ${chunk.order + 1}`,
      })),
    [selectedChunks, isRu],
  );

  const generate = async () => {
    if (!material || selectedChunks.length === 0) {
      toast.error(
        isRu ? "Выбери хотя бы один подтверждённый фрагмент" : "Select at least one approved chunk",
      );
      return;
    }
    if (totalChars > MAX_CHARS) {
      toast.error(
        isRu ? "Выбранные фрагменты слишком длинные" : "The selected chunks are too long",
      );
      return;
    }

    setState("loading");
    setError("");
    const result = await generateStudyPackDraft({
      locale: lang,
      targetLanguage: lang,
      course: course ? { id: course.id, title: course.title, number: course.number } : undefined,
      topic: topic ? { id: topic.id, title: topic.title } : undefined,
      material: { id: material.id, title: material.title, type: material.type },
      chunks: selectedChunks.map<AIChunkInput>((chunk) => ({
        id: chunk.id,
        title: chunk.title,
        text: chunk.text,
        pageNumber: chunk.pageNumber,
        section: chunk.section,
      })),
      instructions: instructions.trim() || undefined,
    });

    if (!result.ok) {
      setError(result.message);
      setState("error");
      return;
    }

    setDraft(result.data);
    setBaseline(JSON.stringify(result.data));
    setSaveLocked(false);
    setSavedResult(null);
    setState("ready");
  };

  const save = () => {
    if (!material || !draft || state !== "ready" || saveDisabled) return;
    setSaveLocked(true);

    try {
      const result = persistStudyPack({
        draft,
        locale: lang,
        materialId: material.id,
        materialTitle: material.title,
        courseId: props.courseId ?? material.courseId,
        topicId: props.topicId ?? material.topicId,
        fallbackSourceChunkIds: selectedChunks.map((chunk) => chunk.id),
      });
      setSavedResult(result);
      setBaseline(serialized);
      setState("saved");
      toast.success(isRu ? "Учебный комплект сохранён" : "Study pack saved");
    } catch (saveError) {
      setSaveLocked(false);
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setState("error");
    }
  };

  return (
    <AIDraftModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={isRu ? "Учебный комплект" : "Study Pack"}
      state={state}
      error={error}
      warnings={draft?.warnings}
      sourceChunks={sources}
      trust={draft?.trust}
      notFoundInSources={draft?.notFoundInSources}
      onSave={save}
      saveDisabled={saveDisabled}
      onRegenerate={generate}
      copyText={draft ? studyPackCopyText(draft, lang) : undefined}
      dirty={dirty}
      savedContent={
        savedResult ? (
          <StudyPackContinuation
            result={savedResult}
            isRu={isRu}
            onNavigate={() => props.onOpenChange(false)}
          />
        ) : undefined
      }
    >
      {state === "idle" && (
        <div className="space-y-4">
          <div className="rounded-md border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">
                  {isRu
                    ? "Один источник → готовое занятие"
                    : "One source → a complete study session"}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {isRu
                    ? "Lamdan соберёт ориентацию, маршрут, конспект, термины, карточки, диагностические вопросы и честно отметит пробелы. Ничего не сохранится без твоего подтверждения."
                    : "Lamdan creates an orientation, route, note, terms, cards, diagnostic questions and explicit gaps. Nothing is saved without your confirmation."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ScopeMetric label={isRu ? "Фрагментов" : "Chunks"} value={selectedChunks.length} />
            <ScopeMetric
              label={isRu ? "Знаков" : "Characters"}
              value={totalChars.toLocaleString()}
            />
            <ScopeMetric
              label={isRu ? "Цель" : "Target"}
              value={isRu ? "25–40 мин" : "25–40 min"}
            />
          </div>

          {requestedChunks.length > MAX_CHUNKS && (
            <p className="rounded border border-yellow-500/30 bg-yellow-500/5 p-2 text-xs text-yellow-200">
              {isRu
                ? `Выбрано ${requestedChunks.length} фрагментов. Для надёжной генерации используются первые ${MAX_CHUNKS}.`
                : `${requestedChunks.length} chunks were selected. The first ${MAX_CHUNKS} are used for reliable generation.`}
            </p>
          )}
          {aiConfigured === false && (
            <p className="rounded border border-yellow-500/30 bg-yellow-500/5 p-2 text-xs text-yellow-200">
              {isRu ? "AI-провайдер сейчас не подключён." : "The AI provider is not configured."}
            </p>
          )}

          <div>
            <Label htmlFor="study-pack-instructions">
              {isRu ? "Дополнительные указания" : "Additional instructions"}
            </Label>
            <Textarea
              id="study-pack-instructions"
              className="mt-1 min-h-24"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder={
                isRu
                  ? "Например: объяснения по-русски, термины оставить на иврите, упор на различия похожих понятий."
                  : "For example: keep Hebrew terms, focus on distinctions between similar concepts."
              }
            />
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={generate}
            disabled={
              selectedChunks.length === 0 || totalChars > MAX_CHARS || aiConfigured === false
            }
          >
            <Sparkles className="h-4 w-4 me-2" />
            {isRu ? "Собрать учебный комплект" : "Build Study Pack"}
          </Button>
        </div>
      )}

      {state === "ready" && draft && (
        <StudyPackEditor
          draft={draft}
          onChange={setDraft}
          isRu={isRu}
          failures={validationFailures}
        />
      )}
    </AIDraftModal>
  );
}

function ScopeMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <strong className="block font-serif text-xl">{value}</strong>
      <span className="mt-1 block text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
