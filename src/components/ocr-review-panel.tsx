import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  FileImage,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { countWords } from "@/lib/document-ingestion";
import { recognizeImageWithOCR } from "@/lib/ocr-client";
import {
  normalizeOCRDraft,
  ocrDraftToChunks,
  validateOCRDraft,
  type OCRDraft,
  type OCRRegion,
  type OCRRegionKind,
  type OCRSourceStyle,
} from "@/lib/ocr-contract";
import { store, type Material, type MaterialSourceLanguage } from "@/lib/store";
import {
  getMaterialOCRDraft,
  getMaterialVisualSource,
  putMaterialOCRDraft,
  type StoredVisualSource,
} from "@/lib/visual-source-store";

const REGION_KINDS: OCRRegionKind[] = [
  "heading",
  "paragraph",
  "list",
  "math",
  "table",
  "diagram",
  "unknown",
];

const SOURCE_STYLES: OCRSourceStyle[] = ["printed", "handwritten", "whiteboard", "mixed"];

export function OCRReviewPanel({ material }: { material: Material }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const [source, setSource] = useState<StoredVisualSource | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<OCRDraft | null>(null);
  const [sourceStyle, setSourceStyle] = useState<OCRSourceStyle>("mixed");
  const [loading, setLoading] = useState(true);
  const [recognizing, setRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    setLoading(true);
    setError(null);
    void Promise.all([
      getMaterialVisualSource(material.id),
      getMaterialOCRDraft(material.id),
    ])
      .then(([storedSource, storedDraft]) => {
        if (cancelled) return;
        if (storedSource) {
          objectUrl = URL.createObjectURL(storedSource.blob);
          setSource(storedSource);
          setImageUrl(objectUrl);
        } else {
          setSource(null);
          setImageUrl(null);
        }
        if (storedDraft) {
          setDraft(storedDraft);
          setSourceStyle(storedDraft.sourceStyle);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [material.id]);

  const isVisualMaterial = material.mimeType?.startsWith("image/") === true;
  const canShow = isVisualMaterial || source !== null || loading;
  const derivedText = useMemo(
    () => draft?.regions.map((region) => region.text.trim()).filter(Boolean).join("\n") ?? "",
    [draft],
  );

  if (!canShow) return null;

  const runOCR = async () => {
    if (!source) {
      toast.error(
        isRu
          ? "Исходное фото не найдено в локальном хранилище"
          : "The source image is missing from local storage",
      );
      return;
    }
    setRecognizing(true);
    setError(null);
    try {
      const result = await recognizeImageWithOCR(source.blob, sourceStyle, lang);
      setDraft(result);
      await putMaterialOCRDraft(material.id, result);
      toast.success(isRu ? "Черновик OCR готов к проверке" : "OCR draft is ready for review");
    } catch (recognitionError) {
      const message = recognitionError instanceof Error ? recognitionError.message : String(recognitionError);
      setError(message);
      toast.error(isRu ? "OCR не завершён" : "OCR did not complete");
    } finally {
      setRecognizing(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const normalized = normalizeOCRDraft(
      { ...draft, text: derivedText, sourceStyle },
      { sourceStyle, locale: lang },
    );
    setDraft(normalized);
    await putMaterialOCRDraft(material.id, normalized);
    toast.success(isRu ? "Черновик OCR сохранён" : "OCR draft saved");
  };

  const applyDraft = async () => {
    if (!draft) return;
    const normalized = normalizeOCRDraft(
      { ...draft, text: derivedText, sourceStyle },
      { sourceStyle, locale: lang },
    );
    const validation = validateOCRDraft(normalized);
    if (!validation.valid || !normalized.text.trim()) {
      toast.error(
        isRu
          ? "В черновике нет подтверждённого читаемого текста"
          : "The draft has no confirmed readable text",
      );
      return;
    }
    const chunks = ocrDraftToChunks(normalized);
    const sourceLanguage = pickMaterialLanguage(normalized.languages);
    store.updateMaterial(material.id, {
      rawText: normalized.text,
      processingStatus: normalized.requiresReview ? "partial" : "ready",
      processingMessage:
        normalized.warnings.length > 0
          ? normalized.warnings.join(" ")
          : isRu
            ? "OCR проверен и применён к материалу."
            : "OCR was reviewed and applied to the material.",
      extractionMethod: "manual",
      pageCount: normalized.pageCount ?? 1,
      wordCount: countWords(normalized.text),
      charCount: normalized.text.length,
      sourceLanguage,
    });
    store.replaceMaterialChunksForMaterial(material.id, chunks);
    await putMaterialOCRDraft(material.id, normalized);
    setDraft(normalized);
    toast.success(
      isRu
        ? `Распознавание применено: ${chunks.length} фрагм.`
        : `Recognition applied: ${chunks.length} chunks`,
    );
  };

  const startManualDraft = () => {
    const next = normalizeOCRDraft(
      {
        text: "",
        sourceStyle,
        languages: ["unknown"],
        confidence: 0,
        requiresReview: true,
        warnings: [
          isRu
            ? "Ручная расшифровка: сверь каждый фрагмент с фотографией."
            : "Manual transcription: verify every region against the image.",
        ],
        regions: [emptyRegion(0)],
      },
      { sourceStyle, locale: lang },
    );
    setDraft(next);
  };

  return (
    <section className="mb-4 rounded-lg border border-border bg-surface">
      <header className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileImage className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl font-semibold">
              {isRu ? "Фото, OCR и рукописный текст" : "Image, OCR and handwriting"}
            </h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            {isRu
              ? "Исходное фото хранится локально. AI создаёт только редактируемый черновик: формулы, знаки и рукописный иврит нужно сверить перед применением."
              : "The source image is stored locally. AI creates only an editable draft: verify formulas, signs and handwritten Hebrew before applying it."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={sourceStyle} onValueChange={(value) => setSourceStyle(value as OCRSourceStyle)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCE_STYLES.map((style) => (
                <SelectItem key={style} value={style}>{sourceStyleCopy(style, isRu)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void runOCR()} disabled={!source || recognizing || loading}>
            {recognizing ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Sparkles className="h-4 w-4 me-1" />}
            {draft ? (isRu ? "Распознать заново" : "Run OCR again") : isRu ? "Распознать фото" : "Run OCR"}
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 me-2 animate-spin" />
          {isRu ? "Загружаю локальное фото…" : "Loading local image…"}
        </div>
      ) : !source ? (
        <div className="p-5">
          <div className="flex gap-2 rounded-md border border-yellow-500/25 bg-yellow-500/5 p-3 text-sm text-yellow-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {isRu
                ? "Метаданные изображения есть, но само фото не найдено. Возможно, оно загружалось до появления локального хранилища или браузер очистил данные. Загрузи фото заново."
                : "Image metadata exists, but the photo is missing. It may predate local image storage or browser data was cleared. Upload it again."}
            </span>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0">
            <div className="sticky top-4 overflow-hidden rounded-md border border-border bg-background">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={source.fileName}
                  className="max-h-[72svh] w-full object-contain"
                />
              )}
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                {source.fileName} · {(source.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            {error && (
              <div className="flex gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            {!draft ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {isRu
                    ? "Запусти OCR или создай ручной черновик, если модель недоступна."
                    : "Run OCR or create a manual draft when the model is unavailable."}
                </p>
                <Button variant="outline" className="mt-4" onClick={startManualDraft}>
                  <Plus className="h-4 w-4 me-1" />
                  {isRu ? "Ручная расшифровка" : "Manual transcription"}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3 text-xs">
                  <div className="flex flex-wrap gap-2">
                    <span>{draft.regions.length} {isRu ? "регионов" : "regions"}</span>
                    <span>{derivedText.length.toLocaleString()} {isRu ? "знаков" : "characters"}</span>
                    <span>
                      {draft.confidence == null
                        ? isRu ? "уверенность неизвестна" : "confidence unknown"
                        : `${Math.round(draft.confidence * 100)}%`}
                    </span>
                  </div>
                  {draft.requiresReview && (
                    <span className="rounded bg-yellow-500/10 px-2 py-1 text-yellow-200">
                      {isRu ? "нужна ручная проверка" : "manual review required"}
                    </span>
                  )}
                </div>

                {draft.warnings.length > 0 && (
                  <div className="rounded-md border border-yellow-500/25 bg-yellow-500/5 p-3 text-xs text-yellow-100">
                    {draft.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                  </div>
                )}

                <div className="space-y-3">
                  {draft.regions.map((region, index) => (
                    <RegionEditor
                      key={region.id}
                      region={region}
                      index={index}
                      count={draft.regions.length}
                      isRu={isRu}
                      onChange={(patch) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                regions: current.regions.map((item) =>
                                  item.id === region.id ? { ...item, ...patch } : item,
                                ),
                              }
                            : current,
                        )
                      }
                      onMove={(direction) =>
                        setDraft((current) =>
                          current
                            ? { ...current, regions: moveRegion(current.regions, index, direction) }
                            : current,
                        )
                      }
                      onDelete={() =>
                        setDraft((current) =>
                          current
                            ? { ...current, regions: current.regions.filter((item) => item.id !== region.id) }
                            : current,
                        )
                      }
                    />
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() =>
                    setDraft((current) =>
                      current
                        ? { ...current, regions: [...current.regions, emptyRegion(current.regions.length)] }
                        : current,
                    )
                  }
                >
                  <Plus className="h-4 w-4 me-1" />
                  {isRu ? "Добавить регион" : "Add region"}
                </Button>

                <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                  <Button variant="outline" onClick={() => void saveDraft()}>
                    <Save className="h-4 w-4 me-1" />
                    {isRu ? "Сохранить черновик" : "Save draft"}
                  </Button>
                  <Button variant="outline" onClick={() => void runOCR()} disabled={recognizing}>
                    <RotateCcw className="h-4 w-4 me-1" />
                    {isRu ? "Сбросить и распознать" : "Reset and recognize"}
                  </Button>
                  <Button onClick={() => void applyDraft()} disabled={!derivedText.trim()}>
                    {isRu ? "Применить к материалу" : "Apply to material"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function RegionEditor({
  region,
  index,
  count,
  isRu,
  onChange,
  onMove,
  onDelete,
}: {
  region: OCRRegion;
  index: number;
  count: number;
  isRu: boolean;
  onChange: (patch: Partial<OCRRegion>) => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">#{index + 1}</span>
        <Select value={region.kind} onValueChange={(value) => onChange({ kind: value as OCRRegionKind })}>
          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REGION_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>{regionKindCopy(kind, isRu)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {region.confidence != null && (
          <span className="text-xs text-muted-foreground">{Math.round(region.confidence * 100)}%</span>
        )}
        {region.uncertainTokens.length > 0 && (
          <span className="rounded bg-yellow-500/10 px-2 py-1 text-[10px] text-yellow-200">
            {isRu ? "сомнительно" : "uncertain"}: {region.uncertainTokens.join(", ")}
          </span>
        )}
        <div className="ms-auto flex gap-1">
          <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove("up")}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" disabled={index >= count - 1} onClick={() => onMove("down")}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Textarea
        dir="auto"
        className="mt-3 min-h-[120px] resize-y leading-6"
        value={region.text}
        onChange={(event) => onChange({ text: event.target.value })}
        placeholder={isRu ? "Точный текст с фотографии" : "Exact text from the image"}
      />
      {region.kind === "math" && (
        <Input
          dir="ltr"
          className="mt-2 font-mono"
          value={region.normalizedMath ?? ""}
          onChange={(event) => onChange({ normalizedMath: event.target.value || undefined })}
          placeholder="x^2 - 4x + 3 = 0"
        />
      )}
    </article>
  );
}

function emptyRegion(index: number): OCRRegion {
  return {
    id: `manual_region_${Date.now()}_${index}`,
    order: index,
    kind: "paragraph",
    text: "",
    uncertainTokens: [],
    warnings: [],
  };
}

function moveRegion(
  regions: OCRRegion[],
  index: number,
  direction: "up" | "down",
): OCRRegion[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= regions.length) return regions;
  const next = regions.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((region, order) => ({ ...region, order }));
}

function pickMaterialLanguage(languages: MaterialSourceLanguage[]): MaterialSourceLanguage {
  const meaningful = Array.from(new Set(languages.filter((language) => language !== "unknown")));
  if (meaningful.length === 0) return "unknown";
  if (meaningful.length === 1) return meaningful[0];
  return "mixed";
}

function sourceStyleCopy(style: OCRSourceStyle, isRu: boolean): string {
  const copy: Record<OCRSourceStyle, [string, string]> = {
    printed: ["Печатный текст", "Printed text"],
    handwritten: ["Рукописный текст", "Handwriting"],
    whiteboard: ["Доска", "Whiteboard"],
    mixed: ["Смешанная страница", "Mixed page"],
  };
  return copy[style][isRu ? 0 : 1];
}

function regionKindCopy(kind: OCRRegionKind, isRu: boolean): string {
  const copy: Record<OCRRegionKind, [string, string]> = {
    heading: ["Заголовок", "Heading"],
    paragraph: ["Абзац", "Paragraph"],
    list: ["Список", "List"],
    math: ["Математика", "Math"],
    table: ["Таблица", "Table"],
    diagram: ["Диаграмма", "Diagram"],
    unknown: ["Другое", "Unknown"],
  };
  return copy[kind][isRu ? 0 : 1];
}
