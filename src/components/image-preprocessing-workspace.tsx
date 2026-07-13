import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Crop,
  Loader2,
  RotateCcw,
  RotateCw,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_IMAGE_PROCESSING_RECIPE,
  estimateImageDeskew,
  hasImageProcessingChanges,
  imageProcessingRecipeKey,
  normalizeImageProcessingRecipe,
  renderProcessedImage,
  rotateImageRecipe,
  type ImageProcessingRecipe,
  type ImageSourceSelection,
  type NormalizedImageCrop,
} from "@/lib/image-preprocessing";
import {
  deleteMaterialImageProcessing,
  getMaterialImageProcessingState,
  getMaterialProcessedVisualSource,
  putMaterialImageProcessingState,
  putMaterialProcessedVisualSource,
  type StoredProcessedVisualSource,
  type StoredVisualSource,
} from "@/lib/visual-source-store";

interface ImagePreprocessingWorkspaceProps {
  materialId: string;
  source: StoredVisualSource;
  isRu: boolean;
  onSourceSelectionChange?: (selection: ImageSourceSelection) => void;
}

/**
 * The editing surface intentionally manages only a recipe and one derived
 * cache. It never mutates `source.blob`, which makes reset and OCR source
 * selection safe even when a browser reloads mid-edit.
 */
export function ImagePreprocessingWorkspace({
  materialId,
  source,
  isRu,
  onSourceSelectionChange,
}: ImagePreprocessingWorkspaceProps) {
  const [recipe, setRecipe] = useState<ImageProcessingRecipe>(DEFAULT_IMAGE_PROCESSING_RECIPE);
  const [selection, setSelection] = useState<ImageSourceSelection>("original");
  const [derived, setDerived] = useState<StoredProcessedVisualSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [deskewing, setDeskewing] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);
  const skipNextPersist = useRef(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    hydrated.current = false;
    void Promise.all([
      getMaterialImageProcessingState(materialId),
      getMaterialProcessedVisualSource(materialId),
    ])
      .then(([storedState, storedDerived]) => {
        if (cancelled) return;
        const sourceMatches = storedState?.sourceUpdatedAt === source.updatedAt;
        const recoveredRecipe = sourceMatches
          ? normalizeImageProcessingRecipe(storedState?.recipe)
          : DEFAULT_IMAGE_PROCESSING_RECIPE;
        const derivedMatches =
          sourceMatches &&
          storedDerived?.sourceUpdatedAt === source.updatedAt &&
          storedDerived.recipeKey === imageProcessingRecipeKey(recoveredRecipe);
        const recoveredSelection =
          storedState?.selectedSource === "processed" && derivedMatches ? "processed" : "original";
        setRecipe(recoveredRecipe);
        setDerived(derivedMatches ? storedDerived : null);
        setSelection(recoveredSelection);
        onSourceSelectionChange?.(recoveredSelection);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(readableError(loadError, isRu));
          setRecipe(DEFAULT_IMAGE_PROCESSING_RECIPE);
          setDerived(null);
          setSelection("original");
          onSourceSelectionChange?.("original");
        }
      })
      .finally(() => {
        if (!cancelled) {
          hydrated.current = true;
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isRu, materialId, onSourceSelectionChange, source.updatedAt]);

  const activeBlob = selection === "processed" && derived ? derived.blob : source.blob;
  const activeName = selection === "processed" && derived ? derived.fileName : source.fileName;

  useEffect(() => {
    const objectUrl = URL.createObjectURL(activeBlob);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [activeBlob]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void putMaterialImageProcessingState(materialId, recipe, selection, source.updatedAt).catch(
        (persistError) => setError(readableError(persistError, isRu)),
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [isRu, materialId, recipe, selection, source.updatedAt]);

  const changeRecipe = (patch: Partial<ImageProcessingRecipe>) => {
    const next = normalizeImageProcessingRecipe({ ...recipe, ...patch });
    setRecipe(next);
    // An old derived cache must never silently become the OCR input after its
    // recipe has changed. The user explicitly regenerates the preview.
    if (selection === "processed") {
      setSelection("original");
      onSourceSelectionChange?.("original");
    }
  };

  const chooseSource = async (next: ImageSourceSelection) => {
    if (next === "processed" && !hasCurrentDerived(derived, recipe, source.updatedAt)) {
      setError(
        isRu
          ? "Сначала обнови обработанный preview: текущая версия не соответствует рецепту."
          : "Update the processed preview first: the current version no longer matches the recipe.",
      );
      return;
    }
    setError(null);
    setSelection(next);
    onSourceSelectionChange?.(next);
    try {
      await putMaterialImageProcessingState(materialId, recipe, next, source.updatedAt);
    } catch (persistError) {
      setError(readableError(persistError, isRu));
    }
  };

  const applyProcessing = async () => {
    if (!hasImageProcessingChanges(recipe)) {
      await chooseSource("original");
      return;
    }
    setRendering(true);
    setError(null);
    try {
      const result = await renderProcessedImage(source.blob, recipe);
      const stored = await putMaterialProcessedVisualSource(materialId, {
        fileName: preparedFileName(source.fileName, result.blob.type),
        mimeType: result.blob.type,
        blob: result.blob,
        width: result.width,
        height: result.height,
        sourceUpdatedAt: source.updatedAt,
        recipe,
      });
      await putMaterialImageProcessingState(materialId, recipe, "processed", source.updatedAt);
      setDerived(stored);
      setSelection("processed");
      onSourceSelectionChange?.("processed");
    } catch (renderError) {
      setError(readableError(renderError, isRu));
    } finally {
      setRendering(false);
    }
  };

  const autoDeskew = async () => {
    setDeskewing(true);
    setError(null);
    try {
      const deskew = await estimateImageDeskew(source.blob, recipe);
      changeRecipe({ deskew });
    } catch (deskewError) {
      setError(readableError(deskewError, isRu));
    } finally {
      setDeskewing(false);
    }
  };

  const resetToOriginal = async () => {
    setError(null);
    setCropMode(false);
    skipNextPersist.current = true;
    setRecipe(DEFAULT_IMAGE_PROCESSING_RECIPE);
    setDerived(null);
    setSelection("original");
    onSourceSelectionChange?.("original");
    try {
      await deleteMaterialImageProcessing(materialId);
    } catch (resetError) {
      setError(readableError(resetError, isRu));
    }
  };

  const previewNeedsRefresh =
    hasImageProcessingChanges(recipe) && !hasCurrentDerived(derived, recipe, source.updatedAt);
  const sourceCopy =
    selection === "processed"
      ? isRu
        ? "обработанная"
        : "processed"
      : isRu
        ? "оригинал"
        : "original";

  return (
    <section className="overflow-hidden rounded-md border border-border bg-background">
      <header className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              {isRu ? "Подготовка фото перед OCR" : "Prepare image before OCR"}
            </h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isRu
              ? "Оригинал не меняется. Рецепт и один обработанный preview сохраняются локально."
              : "The original is never changed. The recipe and one processed preview are saved locally."}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-primary" />
          {isRu ? `OCR: ${sourceCopy}` : `OCR: ${sourceCopy}`}
        </span>
      </header>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
          {isRu ? "Восстанавливаю подготовку фото…" : "Restoring image preparation…"}
        </div>
      ) : (
        <div className="space-y-3 p-3">
          {error && <ProcessingError message={error} />}

          <div className="rounded border border-border bg-surface p-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="min-w-0 truncate">{activeName}</span>
              {previewNeedsRefresh && (
                <span className="rounded bg-yellow-500/10 px-2 py-1 text-yellow-200">
                  {isRu ? "есть несохранённые изменения" : "changes need a preview update"}
                </span>
              )}
            </div>
            {previewUrl && (
              <CropPreview
                imageUrl={previewUrl}
                alt={activeName}
                crop={selection === "original" ? recipe.crop : null}
                cropMode={cropMode && selection === "original"}
                onCropChange={(crop) => changeRecipe({ crop })}
                onDecodeError={() =>
                  setError(
                    isRu
                      ? "Браузер не смог декодировать это изображение для preview."
                      : "The browser could not decode this image for preview.",
                  )
                }
              />
            )}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                {selection === "processed" && derived
                  ? `${derived.width} × ${derived.height} · ${formatBytes(derived.size)}`
                  : `${(source.size / 1024 / 1024).toFixed(2)} MB`}
              </span>
              <span>
                {isRu
                  ? "Ориентация EXIF учитывается при обработке"
                  : "EXIF orientation is applied while processing"}
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={selection === "original" ? "default" : "outline"}
              size="sm"
              onClick={() => void chooseSource("original")}
            >
              {isRu ? "Использовать оригинал" : "Use original"}
            </Button>
            <Button
              type="button"
              variant={selection === "processed" ? "default" : "outline"}
              size="sm"
              disabled={!hasCurrentDerived(derived, recipe, source.updatedAt) || rendering}
              onClick={() => void chooseSource("processed")}
            >
              {isRu ? "Использовать обработанную" : "Use processed"}
            </Button>
          </div>

          <div className="space-y-3 rounded border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium">{isRu ? "Геометрия" : "Geometry"}</span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  title={isRu ? "Повернуть на 90° влево" : "Rotate 90° left"}
                  onClick={() => changeRecipe(rotateImageRecipe(recipe, "counterclockwise"))}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  title={isRu ? "Повернуть на 90° вправо" : "Rotate 90° right"}
                  onClick={() => changeRecipe(rotateImageRecipe(recipe, "clockwise"))}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cropMode ? "default" : "outline"}
                  disabled={selection === "processed"}
                  onClick={() => setCropMode((current) => !current)}
                >
                  <Crop className="me-1 h-3.5 w-3.5" />
                  {isRu ? "Crop" : "Crop"}
                </Button>
              </div>
            </div>
            {cropMode && selection === "original" && (
              <p className="text-[11px] leading-4 text-muted-foreground">
                {isRu
                  ? "Проведи пальцем или мышью по фото, чтобы выбрать область."
                  : "Drag on the image with a finger or mouse to select the crop."}
              </p>
            )}
            {recipe.crop && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => changeRecipe({ crop: null })}
              >
                <Undo2 className="me-1 h-3.5 w-3.5" />
                {isRu ? "Убрать crop" : "Clear crop"}
              </Button>
            )}
            <RangeControl
              label={isRu ? "Точный поворот" : "Fine rotation"}
              value={recipe.rotation}
              min={-15}
              max={15}
              step={0.5}
              unit="°"
              onChange={(rotation) => changeRecipe({ rotation })}
            />
            <RangeControl
              label={isRu ? "Ручной deskew" : "Manual deskew"}
              value={recipe.deskew}
              min={-12}
              max={12}
              step={0.5}
              unit="°"
              onChange={(deskew) => changeRecipe({ deskew })}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={deskewing || rendering}
              onClick={() => void autoDeskew()}
            >
              {deskewing ? (
                <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ScanLine className="me-1 h-3.5 w-3.5" />
              )}
              {isRu ? "Автоматический deskew" : "Auto deskew"}
            </Button>
          </div>

          <div className="space-y-3 rounded border border-border bg-surface p-3">
            <span className="text-xs font-medium">{isRu ? "Читаемость" : "Readability"}</span>
            <SwitchControl
              label={isRu ? "Оттенки серого" : "Grayscale"}
              checked={recipe.grayscale}
              onCheckedChange={(grayscale) => changeRecipe({ grayscale })}
            />
            <RangeControl
              label={isRu ? "Яркость" : "Brightness"}
              value={recipe.brightness}
              min={-100}
              max={100}
              step={1}
              onChange={(brightness) => changeRecipe({ brightness })}
            />
            <RangeControl
              label={isRu ? "Контраст" : "Contrast"}
              value={recipe.contrast}
              min={-100}
              max={100}
              step={1}
              onChange={(contrast) => changeRecipe({ contrast })}
            />
            <SwitchControl
              label={isRu ? "Чёрно-белый режим" : "Black-and-white mode"}
              checked={recipe.threshold !== null}
              onCheckedChange={(checked) => changeRecipe({ threshold: checked ? 160 : null })}
            />
            {recipe.threshold !== null && (
              <RangeControl
                label={isRu ? "Порог" : "Threshold"}
                value={recipe.threshold}
                min={0}
                max={255}
                step={1}
                onChange={(threshold) => changeRecipe({ threshold })}
              />
            )}
            <SwitchControl
              label={isRu ? "Повышение резкости" : "Sharpen"}
              checked={recipe.sharpen > 0}
              onCheckedChange={(checked) => changeRecipe({ sharpen: checked ? 0.35 : 0 })}
            />
            {recipe.sharpen > 0 && (
              <RangeControl
                label={isRu ? "Сила резкости" : "Sharpen amount"}
                value={recipe.sharpen}
                min={0.1}
                max={1}
                step={0.05}
                onChange={(sharpen) => changeRecipe({ sharpen })}
              />
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => void resetToOriginal()}>
              <Undo2 className="me-1 h-3.5 w-3.5" />
              {isRu ? "Вернуть оригинал" : "Reset to original"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={rendering || deskewing || !hasImageProcessingChanges(recipe)}
              onClick={() => void applyProcessing()}
            >
              {rendering ? (
                <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="me-1 h-3.5 w-3.5" />
              )}
              {rendering
                ? isRu
                  ? "Готовлю preview…"
                  : "Preparing preview…"
                : isRu
                  ? "Обновить preview для OCR"
                  : "Update OCR preview"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function CropPreview({
  imageUrl,
  alt,
  crop,
  cropMode,
  onCropChange,
  onDecodeError,
}: {
  imageUrl: string;
  alt: string;
  crop: NormalizedImageCrop | null;
  cropMode: boolean;
  onCropChange: (crop: NormalizedImageCrop) => void;
  onDecodeError: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<NormalizedImageCrop | null>(null);
  const visibleCrop = draft ?? crop;

  const position = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };
  const nextCrop = (point: { x: number; y: number }): NormalizedImageCrop | null => {
    if (!start.current) return null;
    const x = Math.min(start.current.x, point.x);
    const y = Math.min(start.current.y, point.y);
    const width = Math.abs(point.x - start.current.x);
    const height = Math.abs(point.y - start.current.y);
    return width < 0.01 || height < 0.01 ? null : { x, y, width, height };
  };

  return (
    <div className="flex max-h-[58svh] justify-center overflow-auto rounded bg-black/15 p-1">
      <div
        className={
          cropMode ? "relative inline-block cursor-crosshair touch-none" : "relative inline-block"
        }
        style={{ touchAction: cropMode ? "none" : "auto" }}
        onPointerDown={(event) => {
          if (!cropMode) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          start.current = position(event);
          setDraft(null);
        }}
        onPointerMove={(event) => {
          if (!cropMode || !start.current) return;
          setDraft(nextCrop(position(event)));
        }}
        onPointerUp={(event) => {
          if (!cropMode) return;
          const next = nextCrop(position(event));
          start.current = null;
          setDraft(null);
          if (next) onCropChange(next);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDraft(null);
        }}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="block max-h-[56svh] max-w-full select-none object-contain"
          draggable={false}
          onError={onDecodeError}
        />
        {visibleCrop && (
          <div
            className="pointer-events-none absolute border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.34)]"
            style={{
              left: `${visibleCrop.x * 100}%`,
              top: `${visibleCrop.y * 100}%`,
              width: `${visibleCrop.width * 100}%`,
              height: `${visibleCrop.height * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-2 flex justify-between gap-3 text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground">
          {formatControlValue(value)}
          {unit}
        </span>
      </span>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onChange(next[0] ?? value)}
        aria-label={label}
      />
    </label>
  );
}

function SwitchControl({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-7 items-center justify-between gap-3 text-xs">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </label>
  );
}

function ProcessingError({ message }: { message: string }) {
  return (
    <div className="flex gap-2 rounded border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="break-words">{message}</span>
    </div>
  );
}

function hasCurrentDerived(
  derived: StoredProcessedVisualSource | null,
  recipe: ImageProcessingRecipe,
  sourceUpdatedAt: number,
): derived is StoredProcessedVisualSource {
  return Boolean(
    derived &&
    derived.sourceUpdatedAt === sourceUpdatedAt &&
    derived.recipeKey === imageProcessingRecipeKey(recipe),
  );
}

function preparedFileName(fileName: string, mimeType: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "") || "image";
  const extension = mimeType === "image/png" ? "png" : "jpg";
  return `${stem}-prepared.${extension}`;
}

function readableError(error: unknown, isRu: boolean): string {
  const detail = error instanceof Error ? error.message : String(error);
  return isRu
    ? `Не удалось подготовить изображение: ${detail}`
    : `Could not prepare image: ${detail}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatControlValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
