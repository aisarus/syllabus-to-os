import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileImage,
  GripVertical,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Square,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePreprocessingWorkspace } from "@/components/image-preprocessing-workspace";
import { OCRRegionOverlay } from "@/components/ocr-region-overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import {
  normalizeOCRDraft,
  validateOCRDraft,
  type OCRBoundingBox,
  type OCRDraft,
  type OCRRegion,
  type OCRRegionKind,
  type OCRSourceStyle,
  type OCRVisualSourceContext,
} from "@/lib/ocr-contract";
import { recognizeImageWithOCR } from "@/lib/ocr-client";
import {
  appendMultiPageImages,
  applyOCRDraftToMultiPageImage,
  getMultiPageVisualPages,
  isMultiPageImageMaterial,
  removeMultiPageImage,
  reorderMultiPageImages,
  replaceMultiPageImage,
  setMultiPageVisualPageStatus,
  updateMultiPageVisualPage,
  type MultiPageImageMaterial,
  type MultiPageVisualPage,
  type MultiPageVisualStatus,
} from "@/lib/multi-page-image-materials";
import {
  getMaterialOCRDraft,
  getMaterialOCRDraftVisualSource,
  getMaterialOCRImageSource,
  getMaterialVisualSource,
  putMaterialOCRDraft,
  type OCRImageSource,
  type StoredVisualSource,
} from "@/lib/visual-source-store";
import type { ImageSourceSelection } from "@/lib/image-preprocessing";

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

export function MultiPageImageWorkspace({ material }: { material: MultiPageImageMaterial }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const pages = getMultiPageVisualPages(material);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(pages[0]?.id ?? null);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [reloadToken, setReloadToken] = useState(0);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const batchAbortRef = useRef<AbortController | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedPageId && pages.some((page) => page.id === selectedPageId)) return;
    setSelectedPageId(pages[0]?.id ?? null);
  }, [pages, selectedPageId]);

  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  const appliedCount = pages.filter((page) => page.status === "applied").length;
  const reviewCount = pages.filter((page) => page.status === "review").length;
  const errorCount = pages.filter((page) => page.status === "error").length;

  const reorder = (pageId: string, direction: -1 | 1) => {
    const index = pages.findIndex((page) => page.id === pageId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= pages.length) return;
    const ids = pages.map((page) => page.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMultiPageImages(material.id, ids);
  };

  const dropPage = (targetPageId: string) => {
    if (!draggedPageId || draggedPageId === targetPageId) return;
    const ids = pages.map((page) => page.id).filter((pageId) => pageId !== draggedPageId);
    const targetIndex = ids.indexOf(targetPageId);
    ids.splice(Math.max(0, targetIndex), 0, draggedPageId);
    reorderMultiPageImages(material.id, ids);
    setDraggedPageId(null);
  };

  const addPages = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const result = await appendMultiPageImages(material.id, Array.from(files));
      if (result.addedPages.length > 0) {
        setSelectedPageId(result.addedPages[0].id);
        toast.success(
          isRu
            ? `Добавлено страниц: ${result.addedPages.length}`
            : `Pages added: ${result.addedPages.length}`,
        );
      }
      if (result.skippedDuplicates.length > 0) {
        toast.warning(
          isRu
            ? `Пропущены дубликаты: ${result.skippedDuplicates.join(", ")}`
            : `Duplicates skipped: ${result.skippedDuplicates.join(", ")}`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const replacePage = async (file: File | undefined) => {
    if (!file || !replaceTarget) return;
    try {
      await replaceMultiPageImage(material.id, replaceTarget, file);
      setReloadToken((value) => value + 1);
      toast.success(isRu ? "Страница заменена" : "Page replaced");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setReplaceTarget(null);
    }
  };

  const deletePage = async (page: MultiPageVisualPage) => {
    const confirmed = confirm(
      isRu
        ? `Удалить страницу ${page.order + 1} «${page.fileName}» вместе с OCR и её фрагментами?`
        : `Delete page ${page.order + 1} “${page.fileName}” with its OCR and chunks?`,
    );
    if (!confirmed) return;
    await removeMultiPageImage(material.id, page.id);
    toast.success(isRu ? "Страница удалена" : "Page deleted");
  };

  const runPageOCR = useCallback(
    async (page: MultiPageVisualPage, signal?: AbortSignal) => {
      setMultiPageVisualPageStatus(material.id, page.id, "recognizing", "OCR is running.");
      const source = await getMaterialOCRImageSource(page.id);
      if (!source) throw new Error(`Source image is missing: ${page.fileName}`);
      const draft = await recognizeImageWithOCR(source.source.blob, "mixed", lang, signal);
      const withSource: OCRDraft = { ...draft, visualSource: visualSourceContextFor(source) };
      await putMaterialOCRDraft(page.id, withSource);
      updateMultiPageVisualPage(material.id, page.id, {
        status: "review",
        message: withSource.requiresReview
          ? "OCR draft is ready and requires review."
          : "OCR draft is ready for confirmation.",
      });
      return withSource;
    },
    [lang, material.id],
  );

  const runAllOCR = async () => {
    const candidates = pages.filter((page) => page.status !== "applied");
    if (candidates.length === 0) {
      toast.message(isRu ? "Все страницы уже применены" : "All pages are already applied");
      return;
    }
    const controller = new AbortController();
    batchAbortRef.current = controller;
    setBatchRunning(true);
    setBatchProgress({ done: 0, total: candidates.length });
    let completed = 0;
    let failed = 0;
    for (const page of candidates) {
      if (controller.signal.aborted) {
        setMultiPageVisualPageStatus(material.id, page.id, "cancelled", "Batch OCR was cancelled.");
        continue;
      }
      try {
        await runPageOCR(page, controller.signal);
        completed += 1;
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          setMultiPageVisualPageStatus(material.id, page.id, "cancelled", "Batch OCR was cancelled.");
        } else {
          failed += 1;
          setMultiPageVisualPageStatus(
            material.id,
            page.id,
            "error",
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      setBatchProgress((current) => ({ ...current, done: current.done + 1 }));
    }
    setBatchRunning(false);
    batchAbortRef.current = null;
    setReloadToken((value) => value + 1);
    toast.success(
      isRu
        ? `OCR завершён: ${completed}, ошибок: ${failed}`
        : `OCR complete: ${completed}, failed: ${failed}`,
    );
  };

  const applyReviewedPages = async () => {
    const reviewed = getMultiPageVisualPages(material).filter((page) => page.status === "review");
    let applied = 0;
    let skipped = 0;
    for (const page of reviewed) {
      const draft = await getMaterialOCRDraft(page.id);
      if (!draft || !validateOCRDraft(draft).valid || !draft.text.trim()) {
        skipped += 1;
        continue;
      }
      try {
        await applyOCRDraftToMultiPageImage(material.id, page.id, draft, lang);
        applied += 1;
      } catch {
        skipped += 1;
      }
    }
    setReloadToken((value) => value + 1);
    toast.success(
      isRu
        ? `Применено страниц: ${applied}${skipped ? `, пропущено: ${skipped}` : ""}`
        : `Pages applied: ${applied}${skipped ? `, skipped: ${skipped}` : ""}`,
    );
  };

  if (!isMultiPageImageMaterial(material)) return null;

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileImage className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl font-semibold">
              {isRu ? "Многостраничный фотоматериал" : "Multi-page image material"}
            </h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            {isRu
              ? "Каждая страница хранит собственное фото, обработку и OCR-черновик. Ошибка одной страницы не затрагивает остальные."
              : "Each page keeps its own source image, preprocessing and OCR draft. One failed page never destroys the others."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span>{pages.length} {isRu ? "страниц" : "pages"}</span>
            <span>{appliedCount} {isRu ? "применено" : "applied"}</span>
            <span>{reviewCount} {isRu ? "на проверке" : "awaiting review"}</span>
            {errorCount > 0 && <span className="text-red-300">{errorCount} {isRu ? "ошибок" : "errors"}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={addInputRef}
            type="file"
            multiple
            hidden
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) => {
              void addPages(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={replaceInputRef}
            type="file"
            hidden
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) => {
              void replacePage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => addInputRef.current?.click()}>
            <Plus className="h-4 w-4 me-1" />
            {isRu ? "Добавить страницы" : "Add pages"}
          </Button>
          {batchRunning ? (
            <Button variant="destructive" onClick={() => batchAbortRef.current?.abort()}>
              <Square className="h-4 w-4 me-1" />
              {isRu ? "Отменить OCR" : "Cancel OCR"} {batchProgress.done}/{batchProgress.total}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void runAllOCR()}>
              <Sparkles className="h-4 w-4 me-1" />
              {isRu ? "OCR всех страниц" : "OCR all pages"}
            </Button>
          )}
          <Button onClick={() => void applyReviewedPages()} disabled={reviewCount === 0}>
            <CheckCircle2 className="h-4 w-4 me-1" />
            {isRu ? "Применить проверенные" : "Apply reviewed"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-[640px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-border p-3 lg:border-b-0 lg:border-e">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isRu ? "Страницы" : "Pages"}
          </div>
          <div className="max-h-[70svh] space-y-2 overflow-y-auto pe-1">
            {pages.map((page) => (
              <PageRow
                key={page.id}
                page={page}
                selected={page.id === selectedPage?.id}
                isRu={isRu}
                onSelect={() => setSelectedPageId(page.id)}
                onMoveUp={() => reorder(page.id, -1)}
                onMoveDown={() => reorder(page.id, 1)}
                onReplace={() => {
                  setReplaceTarget(page.id);
                  replaceInputRef.current?.click();
                }}
                onDelete={() => void deletePage(page)}
                onRetry={() => {
                  setSelectedPageId(page.id);
                  void runPageOCR(page)
                    .then(() => setReloadToken((value) => value + 1))
                    .catch((error) => {
                      setMultiPageVisualPageStatus(
                        material.id,
                        page.id,
                        "error",
                        error instanceof Error ? error.message : String(error),
                      );
                    });
                }}
                draggable
                onDragStart={() => setDraggedPageId(page.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropPage(page.id)}
              />
            ))}
          </div>
        </aside>

        <div className="min-w-0 p-4">
          {selectedPage ? (
            <MultiPageSinglePageEditor
              key={`${selectedPage.id}:${reloadToken}`}
              material={material}
              page={selectedPage}
              isRu={isRu}
              lang={lang}
              onStatusChange={(status, message) =>
                setMultiPageVisualPageStatus(material.id, selectedPage.id, status, message)
              }
              onApplied={() => setReloadToken((value) => value + 1)}
            />
          ) : (
            <div className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
              {isRu ? "Добавь хотя бы одну страницу" : "Add at least one page"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MultiPageSinglePageEditor({
  material,
  page,
  isRu,
  lang,
  onStatusChange,
  onApplied,
}: {
  material: MultiPageImageMaterial;
  page: MultiPageVisualPage;
  isRu: boolean;
  lang: "ru" | "en";
  onStatusChange: (status: MultiPageVisualStatus, message?: string) => void;
  onApplied: () => void;
}) {
  const [source, setSource] = useState<StoredVisualSource | null>(null);
  const [ocrSelection, setOcrSelection] = useState<ImageSourceSelection>("original");
  const [draft, setDraft] = useState<OCRDraft | null>(null);
  const [overlaySource, setOverlaySource] = useState<OCRImageSource | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [sourceStyle, setSourceStyle] = useState<OCRSourceStyle>("mixed");
  const [loading, setLoading] = useState(true);
  const [recognizing, setRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [storedSource, storedDraft, selectedSource] = await Promise.all([
        getMaterialVisualSource(page.id),
        getMaterialOCRDraft(page.id),
        getMaterialOCRImageSource(page.id),
      ]);
      setSource(storedSource ?? null);
      setOcrSelection(selectedSource?.kind ?? "original");
      setDraft(storedDraft ?? null);
      if (storedDraft) {
        setSourceStyle(storedDraft.sourceStyle);
        setSelectedRegionId(storedDraft.regions[0]?.id ?? null);
        const exactSource = storedDraft.visualSource
          ? await getMaterialOCRDraftVisualSource(page.id, storedDraft.visualSource)
          : undefined;
        setOverlaySource(exactSource ?? null);
      } else {
        setOverlaySource(selectedSource ?? null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [page.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const derivedText = useMemo(
    () => draft?.regions.map((region) => region.text.trim()).filter(Boolean).join("\n") ?? "",
    [draft],
  );

  const updateRegion = (regionId: string, patch: Partial<OCRRegion>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            regions: current.regions.map((region) =>
              region.id === regionId ? { ...region, ...patch } : region,
            ),
          }
        : current,
    );
  };

  const createRegion = (boundingBox: OCRBoundingBox) => {
    const region = emptyRegion(draft?.regions.length ?? 0, boundingBox);
    setDraft((current) =>
      current ? { ...current, regions: [...current.regions, region] } : manualDraft(sourceStyle, lang, region),
    );
    setSelectedRegionId(region.id);
  };

  const runOCR = async () => {
    setRecognizing(true);
    setError(null);
    onStatusChange("recognizing", "OCR is running.");
    try {
      const ocrSource = await getMaterialOCRImageSource(page.id);
      if (!ocrSource) throw new Error("Source image is missing from local storage.");
      const result = await recognizeImageWithOCR(ocrSource.source.blob, sourceStyle, lang);
      const next = { ...result, visualSource: visualSourceContextFor(ocrSource) };
      await putMaterialOCRDraft(page.id, next);
      setDraft(next);
      setOverlaySource(ocrSource);
      setOcrSelection(ocrSource.kind);
      setSelectedRegionId(next.regions[0]?.id ?? null);
      onStatusChange("review", "OCR draft is ready for review.");
      toast.success(isRu ? `OCR страницы ${page.order + 1} готов` : `Page ${page.order + 1} OCR is ready`);
    } catch (recognitionError) {
      const message = recognitionError instanceof Error ? recognitionError.message : String(recognitionError);
      setError(message);
      onStatusChange("error", message);
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
    await putMaterialOCRDraft(page.id, normalized);
    setDraft(normalized);
    onStatusChange("review", "OCR draft saved; apply it when verified.");
    toast.success(isRu ? "Черновик страницы сохранён" : "Page draft saved");
  };

  const applyDraft = async () => {
    if (!draft) return;
    try {
      const normalized = normalizeOCRDraft(
        { ...draft, text: derivedText, sourceStyle },
        { sourceStyle, locale: lang },
      );
      const count = await applyOCRDraftToMultiPageImage(material.id, page.id, normalized, lang);
      await putMaterialOCRDraft(page.id, normalized);
      setDraft(normalized);
      onApplied();
      toast.success(
        isRu
          ? `Страница ${page.order + 1} применена: ${count} фрагм.`
          : `Page ${page.order + 1} applied: ${count} chunks`,
      );
    } catch (applyError) {
      toast.error(applyError instanceof Error ? applyError.message : String(applyError));
    }
  };

  const startManual = () => {
    const region = emptyRegion(0);
    const next = manualDraft(sourceStyle, lang, region, overlaySource ?? undefined);
    setDraft(next);
    setSelectedRegionId(region.id);
    onStatusChange("review", "Manual transcription draft created.");
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 me-2 animate-spin" />
        {isRu ? "Загружаю страницу…" : "Loading page…"}
      </div>
    );
  }
  if (!source) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
        {isRu ? "Исходное изображение страницы отсутствует" : "The page source image is missing"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <strong>{isRu ? `Страница ${page.order + 1}` : `Page ${page.order + 1}`}</strong>
          <p className="truncate text-xs text-muted-foreground">{page.fileName}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isRu ? "Источник OCR" : "OCR source"}: {ocrSelection === "processed" ? (isRu ? "обработанная версия" : "processed") : (isRu ? "оригинал" : "original")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={sourceStyle} onValueChange={(value) => setSourceStyle(value as OCRSourceStyle)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCE_STYLES.map((style) => (
                <SelectItem key={style} value={style}>{sourceStyleCopy(style, isRu)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void runOCR()} disabled={recognizing}>
            {recognizing ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Sparkles className="h-4 w-4 me-1" />}
            {draft ? (isRu ? "OCR заново" : "Run again") : "OCR"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-3">
          <ImagePreprocessingWorkspace
            materialId={page.id}
            source={source}
            isRu={isRu}
            onSourceSelectionChange={(selection) => {
              setOcrSelection(selection);
              void getMaterialOCRImageSource(page.id).then((next) => {
                if (!draft) setOverlaySource(next ?? null);
              });
            }}
          />
          {draft && overlaySource ? (
            <OCRRegionOverlay
              source={overlaySource}
              regions={draft.regions}
              selectedRegionId={selectedRegionId}
              hoveredRegionId={hoveredRegionId}
              isRu={isRu}
              onSelectRegion={setSelectedRegionId}
              onHoverRegion={setHoveredRegionId}
              onUpdateRegion={updateRegion}
              onCreateRegion={createRegion}
            />
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          {!draft ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {isRu ? "Запусти OCR или создай ручной черновик." : "Run OCR or create a manual draft."}
              </p>
              <Button variant="outline" className="mt-4" onClick={startManual}>
                <Plus className="h-4 w-4 me-1" />
                {isRu ? "Ручная расшифровка" : "Manual transcription"}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3 text-xs">
                <span>{draft.regions.length} {isRu ? "регионов" : "regions"}</span>
                <span>{derivedText.length} {isRu ? "знаков" : "characters"}</span>
                {draft.requiresReview && <span className="text-yellow-200">{isRu ? "нужна проверка" : "review required"}</span>}
              </div>
              <div className="space-y-3">
                {draft.regions.map((region, index) => (
                  <PageRegionEditor
                    key={region.id}
                    region={region}
                    index={index}
                    selected={selectedRegionId === region.id}
                    isRu={isRu}
                    onSelect={() => setSelectedRegionId(region.id)}
                    onChange={(patch) => updateRegion(region.id, patch)}
                    onDelete={() => {
                      if (!confirm(isRu ? "Удалить этот OCR-регион?" : "Delete this OCR region?")) return;
                      setDraft((current) =>
                        current
                          ? { ...current, regions: current.regions.filter((entry) => entry.id !== region.id) }
                          : current,
                      );
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    const region = emptyRegion(draft.regions.length);
                    setDraft({ ...draft, regions: [...draft.regions, region] });
                    setSelectedRegionId(region.id);
                  }}
                >
                  <Plus className="h-4 w-4 me-1" />
                  {isRu ? "Добавить регион" : "Add region"}
                </Button>
                <Button variant="outline" onClick={() => void saveDraft()}>
                  <Save className="h-4 w-4 me-1" />
                  {isRu ? "Сохранить черновик" : "Save draft"}
                </Button>
                <Button onClick={() => void applyDraft()} disabled={!derivedText.trim()}>
                  <CheckCircle2 className="h-4 w-4 me-1" />
                  {isRu ? "Применить страницу" : "Apply page"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PageRow({
  page,
  selected,
  isRu,
  onSelect,
  onMoveUp,
  onMoveDown,
  onReplace,
  onDelete,
  onRetry,
  ...dragProps
}: {
  page: MultiPageVisualPage;
  selected: boolean;
  isRu: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReplace: () => void;
  onDelete: () => void;
  onRetry: () => void;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...dragProps}
      className={`rounded-md border p-2 ${selected ? "border-primary bg-primary/5" : "border-border bg-background"}`}
    >
      <button type="button" className="flex w-full items-start gap-2 text-start" onClick={onSelect}>
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <strong className="block text-xs">{isRu ? "Страница" : "Page"} {page.order + 1}</strong>
          <span className="block truncate text-[11px] text-muted-foreground">{page.fileName}</span>
          <span className={`mt-1 inline-flex items-center gap-1 text-[10px] ${statusClass(page.status)}`}>
            {statusIcon(page.status)} {statusCopy(page.status, isRu)}
          </span>
        </span>
      </button>
      <div className="mt-2 flex flex-wrap gap-1 border-t border-border pt-2">
        <Button size="icon" variant="ghost" onClick={onMoveUp} aria-label={isRu ? "Выше" : "Move up"}><ArrowUp className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" onClick={onMoveDown} aria-label={isRu ? "Ниже" : "Move down"}><ArrowDown className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" onClick={onRetry} aria-label={isRu ? "Повторить OCR" : "Retry OCR"}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" onClick={onReplace} aria-label={isRu ? "Заменить фото" : "Replace image"}><Upload className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label={isRu ? "Удалить страницу" : "Delete page"}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function PageRegionEditor({
  region,
  index,
  selected,
  isRu,
  onSelect,
  onChange,
  onDelete,
}: {
  region: OCRRegion;
  index: number;
  selected: boolean;
  isRu: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<OCRRegion>) => void;
  onDelete: () => void;
}) {
  return (
    <article className={`rounded-md border p-3 ${selected ? "border-primary" : "border-border"}`} onClick={onSelect}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">#{index + 1}</span>
        <Select value={region.kind} onValueChange={(value) => onChange({ kind: value as OCRRegionKind })}>
          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REGION_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{regionKindCopy(kind, isRu)}</SelectItem>)}
          </SelectContent>
        </Select>
        {region.confidence != null && <span className="text-xs text-muted-foreground">{Math.round(region.confidence * 100)}%</span>}
        <Button size="icon" variant="ghost" className="ms-auto" onClick={(event) => { event.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Textarea
        dir="auto"
        className="mt-2 min-h-[100px] resize-y"
        value={region.text}
        onChange={(event) => onChange({ text: event.target.value })}
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
      {region.uncertainTokens.length > 0 && (
        <p className="mt-2 text-[10px] text-yellow-200">
          {isRu ? "Сомнительно" : "Uncertain"}: {region.uncertainTokens.join(", ")}
        </p>
      )}
    </article>
  );
}

function manualDraft(
  sourceStyle: OCRSourceStyle,
  locale: "ru" | "en",
  region: OCRRegion,
  source?: OCRImageSource,
): OCRDraft {
  return normalizeOCRDraft(
    {
      text: "",
      sourceStyle,
      languages: ["unknown"],
      confidence: 0,
      requiresReview: true,
      warnings: [locale === "ru" ? "Ручная расшифровка." : "Manual transcription."],
      regions: [region],
      visualSource: source ? visualSourceContextFor(source) : undefined,
    },
    { sourceStyle, locale },
  );
}

function emptyRegion(index: number, boundingBox?: OCRBoundingBox): OCRRegion {
  return {
    id: `manual_region_${Date.now()}_${index}`,
    order: index,
    kind: "paragraph",
    text: "",
    boundingBox,
    uncertainTokens: [],
    warnings: [],
  };
}

function visualSourceContextFor(source: OCRImageSource): OCRVisualSourceContext {
  return source.kind === "original"
    ? { kind: "original", sourceUpdatedAt: source.source.updatedAt }
    : {
        kind: "processed",
        sourceUpdatedAt: source.source.sourceUpdatedAt,
        processedRecipeKey: source.source.recipeKey,
      };
}

function statusCopy(status: MultiPageVisualStatus, isRu: boolean): string {
  const values: Record<MultiPageVisualStatus, [string, string]> = {
    awaiting_ocr: ["ждёт OCR", "awaiting OCR"],
    recognizing: ["распознаётся", "recognizing"],
    review: ["нужна проверка", "review needed"],
    applied: ["применено", "applied"],
    error: ["ошибка", "error"],
    cancelled: ["отменено", "cancelled"],
  };
  return values[status][isRu ? 0 : 1];
}

function statusClass(status: MultiPageVisualStatus): string {
  if (status === "applied") return "text-emerald-300";
  if (status === "error") return "text-red-300";
  if (status === "review") return "text-yellow-200";
  return "text-muted-foreground";
}

function statusIcon(status: MultiPageVisualStatus) {
  if (status === "recognizing") return <Loader2 className="h-3 w-3 animate-spin" />;
  if (status === "applied") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "error") return <XCircle className="h-3 w-3" />;
  return <FileImage className="h-3 w-3" />;
}

function sourceStyleCopy(style: OCRSourceStyle, isRu: boolean): string {
  const values: Record<OCRSourceStyle, [string, string]> = {
    printed: ["Печатный текст", "Printed text"],
    handwritten: ["Рукописный текст", "Handwriting"],
    whiteboard: ["Доска", "Whiteboard"],
    mixed: ["Смешанная страница", "Mixed page"],
  };
  return values[style][isRu ? 0 : 1];
}

function regionKindCopy(kind: OCRRegionKind, isRu: boolean): string {
  const values: Record<OCRRegionKind, [string, string]> = {
    heading: ["Заголовок", "Heading"],
    paragraph: ["Абзац", "Paragraph"],
    list: ["Список", "List"],
    math: ["Математика", "Math"],
    table: ["Таблица", "Table"],
    diagram: ["Диаграмма", "Diagram"],
    unknown: ["Другое", "Unknown"],
  };
  return values[kind][isRu ? 0 : 1];
}
