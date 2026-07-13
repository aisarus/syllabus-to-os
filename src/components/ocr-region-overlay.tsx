import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { Focus, Hand, Minus, MousePointer2, PenLine, Plus, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  moveOCRBoundingBox,
  resizeOCRBoundingBox,
  type OCRBoundingBox,
  type OCRRegion,
} from "@/lib/ocr-contract";
import type { OCRImageSource } from "@/lib/visual-source-store";

type OverlayMode = "select" | "draw" | "pan";

type DragState =
  | {
      kind: "draw";
      start: OverlayPoint;
      current: OverlayPoint;
    }
  | {
      kind: "move" | "resize";
      regionId: string;
      start: OverlayPoint;
      original: OCRBoundingBox;
    }
  | {
      kind: "pan";
      startClientX: number;
      startClientY: number;
      originX: number;
      originY: number;
    };

interface OverlayPoint {
  x: number;
  y: number;
}

export interface OCRRegionOverlayProps {
  source: OCRImageSource;
  regions: OCRRegion[];
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
  isRu: boolean;
  onSelectRegion: (regionId: string | null) => void;
  onHoverRegion: (regionId: string | null) => void;
  onUpdateRegion: (regionId: string, patch: Partial<OCRRegion>) => void;
  onCreateRegion: (boundingBox: OCRBoundingBox) => void;
}

/**
 * A coordinate-aware source viewer. Its image and boxes share one transformed
 * stage, so zoom/pan never changes their normalized 0..1 relationship.
 */
export function OCRRegionOverlay({
  source,
  regions,
  selectedRegionId,
  hoveredRegionId,
  isRu,
  onSelectRegion,
  onHoverRegion,
  onUpdateRegion,
  onCreateRegion,
}: OCRRegionOverlayProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<OverlayMode>("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(source.source.blob);
    setImageUrl(objectUrl);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setImageError(null);
    return () => URL.revokeObjectURL(objectUrl);
  }, [source.source.blob]);

  const boundedRegions = useMemo(
    () =>
      regions.filter((region): region is OCRRegion & { boundingBox: OCRBoundingBox } =>
        Boolean(region.boundingBox),
      ),
    [regions],
  );
  const drawingBox = drag?.kind === "draw" ? boxFromPoints(drag.start, drag.current) : null;

  const pointForEvent = (event: Pick<PointerEvent<HTMLDivElement>, "clientX" | "clientY">) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const startStagePointer = (event: PointerEvent<HTMLDivElement>) => {
    const point = pointForEvent(event);
    if (!point) return;
    if (mode === "pan") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({
        kind: "pan",
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: pan.x,
        originY: pan.y,
      });
      return;
    }
    if (mode === "draw") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ kind: "draw", start: point, current: point });
      return;
    }

    const hit = regionAtPoint(boundedRegions, point);
    onSelectRegion(hit?.id ?? null);
  };

  const moveStagePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    if (drag.kind === "pan") {
      setPan({
        x: drag.originX + event.clientX - drag.startClientX,
        y: drag.originY + event.clientY - drag.startClientY,
      });
      return;
    }
    const point = pointForEvent(event);
    if (!point) return;
    if (drag.kind === "draw") {
      setDrag({ ...drag, current: point });
      return;
    }
    const deltaX = point.x - drag.start.x;
    const deltaY = point.y - drag.start.y;
    onUpdateRegion(drag.regionId, {
      boundingBox:
        drag.kind === "move"
          ? moveOCRBoundingBox(drag.original, deltaX, deltaY)
          : resizeOCRBoundingBox(
              drag.original,
              drag.original.width + deltaX,
              drag.original.height + deltaY,
            ),
    });
  };

  const finishStagePointer = () => {
    if (drag?.kind === "draw") {
      const box = boxFromPoints(drag.start, drag.current);
      if (box) onCreateRegion(box);
    }
    setDrag(null);
  };

  const beginRegionDrag = (
    event: PointerEvent<HTMLDivElement>,
    region: OCRRegion & { boundingBox: OCRBoundingBox },
    kind: "move" | "resize",
  ) => {
    if (mode !== "select") return;
    const point = pointForEvent(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectRegion(region.id);
    setDrag({ kind, regionId: region.id, start: point, original: region.boundingBox });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom((current) => clamp(current + (event.deltaY < 0 ? 0.15 : -0.15), 0.5, 3));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setMode("select");
  };

  return (
    <section className="mt-3 overflow-hidden rounded-md border border-border bg-background">
      <header className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              {isRu ? "Регионы OCR на изображении" : "OCR regions on image"}
            </h3>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {isRu
              ? `Координаты привязаны к ${source.kind === "processed" ? "обработанной" : "оригинальной"} версии, которая была отправлена в OCR.`
              : `Coordinates are bound to the ${source.kind === "processed" ? "processed" : "original"} version sent to OCR.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <ToolButton
            active={mode === "select"}
            label={isRu ? "Выбор областей" : "Select regions"}
            onClick={() => setMode("select")}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton
            active={mode === "draw"}
            label={isRu ? "Нарисовать регион" : "Draw region"}
            onClick={() => setMode("draw")}
          >
            <PenLine className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton
            active={mode === "pan"}
            label={isRu ? "Перемещать изображение" : "Pan image"}
            onClick={() => setMode("pan")}
          >
            <Hand className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton label={isRu ? "Уместить страницу" : "Fit page"} onClick={resetView}>
            <Focus className="h-3.5 w-3.5" />
          </ToolButton>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span>{isRu ? "Масштаб" : "Zoom"}</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={isRu ? "Уменьшить масштаб" : "Zoom out"}
          onClick={() => setZoom((current) => clamp(current - 0.15, 0.5, 3))}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-10 text-center font-mono text-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={isRu ? "Увеличить масштаб" : "Zoom in"}
          onClick={() => setZoom((current) => clamp(current + 0.15, 0.5, 3))}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <span className="ms-auto">
          {boundedRegions.length}/{regions.length} {isRu ? "с координатами" : "with coordinates"}
        </span>
      </div>

      {imageError ? (
        <div className="p-4 text-xs text-destructive">{imageError}</div>
      ) : (
        <div
          className="grid min-h-[280px] touch-pan-y place-items-center overflow-hidden bg-black/20 p-3 sm:min-h-[420px]"
          style={{ touchAction: mode === "select" ? "pan-y" : "none" }}
          onWheel={handleWheel}
          onPointerDown={startStagePointer}
          onPointerMove={moveStagePointer}
          onPointerUp={finishStagePointer}
          onPointerCancel={finishStagePointer}
        >
          <div
            ref={stageRef}
            className={
              mode === "draw" ? "relative inline-block cursor-crosshair" : "relative inline-block"
            }
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            {imageUrl && (
              <img
                src={imageUrl}
                alt={source.source.fileName}
                className="block max-h-[58svh] max-w-full select-none object-contain"
                draggable={false}
                onError={() =>
                  setImageError(
                    isRu
                      ? "Браузер не смог декодировать изображение для region overlay."
                      : "The browser could not decode the image for the region overlay.",
                  )
                }
              />
            )}
            {boundedRegions.map((region) => (
              <RegionBox
                key={region.id}
                region={region}
                selected={selectedRegionId === region.id}
                hovered={hoveredRegionId === region.id}
                isRu={isRu}
                onHover={onHoverRegion}
                onSelect={onSelectRegion}
                onPointerDown={beginRegionDrag}
                onUpdate={onUpdateRegion}
              />
            ))}
            {drawingBox && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/10"
                style={boxStyle(drawingBox)}
              />
            )}
          </div>
        </div>
      )}

      <footer className="border-t border-border px-3 py-2 text-[11px] leading-4 text-muted-foreground">
        {mode === "draw"
          ? isRu
            ? "Проведи по фото, чтобы создать новый регион."
            : "Drag on the photo to create a new region."
          : mode === "pan"
            ? isRu
              ? "Перетаскивай изображение; вернись к стрелке для выбора региона."
              : "Drag the image; return to the arrow to select a region."
            : isRu
              ? "Клик по области выбирает текст; перетащи область, чтобы переместить, или нижний угол, чтобы изменить размер. Стрелки клавиатуры двигают выбранный регион."
              : "Click an area to select text; drag it to move, or its lower corner to resize. Arrow keys move the selected region."}
      </footer>
    </section>
  );
}

function RegionBox({
  region,
  selected,
  hovered,
  isRu,
  onHover,
  onSelect,
  onPointerDown,
  onUpdate,
}: {
  region: OCRRegion & { boundingBox: OCRBoundingBox };
  selected: boolean;
  hovered: boolean;
  isRu: boolean;
  onHover: (regionId: string | null) => void;
  onSelect: (regionId: string | null) => void;
  onPointerDown: (
    event: PointerEvent<HTMLDivElement>,
    region: OCRRegion & { boundingBox: OCRBoundingBox },
    kind: "move" | "resize",
  ) => void;
  onUpdate: (regionId: string, patch: Partial<OCRRegion>) => void;
}) {
  const stateClass = regionStateClass(region, selected, hovered);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={regionLabel(region, isRu)}
      aria-pressed={selected}
      className={`absolute cursor-move border-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${stateClass}`}
      style={boxStyle(region.boundingBox)}
      onPointerDown={(event) => onPointerDown(event, region, "move")}
      onPointerEnter={() => onHover(region.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => {
        onSelect(region.id);
        onHover(region.id);
      }}
      onBlur={() => onHover(null)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(region.id);
          return;
        }
        const step = event.shiftKey ? 0.05 : 0.01;
        let next: OCRBoundingBox | null = null;
        if (event.key === "ArrowLeft") next = moveOCRBoundingBox(region.boundingBox, -step, 0);
        if (event.key === "ArrowRight") next = moveOCRBoundingBox(region.boundingBox, step, 0);
        if (event.key === "ArrowUp") next = moveOCRBoundingBox(region.boundingBox, 0, -step);
        if (event.key === "ArrowDown") next = moveOCRBoundingBox(region.boundingBox, 0, step);
        if (next) {
          event.preventDefault();
          onSelect(region.id);
          onUpdate(region.id, { boundingBox: next });
        }
      }}
    >
      <span className="absolute -top-5 start-0 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
        #{region.order + 1} {region.kind === "math" ? "∑" : region.kind}
      </span>
      <div
        role="button"
        tabIndex={-1}
        aria-label={isRu ? "Изменить размер региона" : "Resize region"}
        className="absolute -bottom-1 -end-1 h-3 w-3 cursor-nwse-resize border border-background bg-primary"
        onPointerDown={(event) => onPointerDown(event, region, "resize")}
      />
    </div>
  );
}

function ToolButton({
  active = false,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "default" : "ghost"}
      className="h-7 w-7"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function regionAtPoint(
  regions: Array<OCRRegion & { boundingBox: OCRBoundingBox }>,
  point: OverlayPoint,
): (OCRRegion & { boundingBox: OCRBoundingBox }) | undefined {
  return regions
    .filter(
      (region) =>
        point.x >= region.boundingBox.x &&
        point.x <= region.boundingBox.x + region.boundingBox.width &&
        point.y >= region.boundingBox.y &&
        point.y <= region.boundingBox.y + region.boundingBox.height,
    )
    .sort((left, right) => {
      const leftArea = left.boundingBox.width * left.boundingBox.height;
      const rightArea = right.boundingBox.width * right.boundingBox.height;
      return leftArea - rightArea || left.order - right.order;
    })[0];
}

function boxFromPoints(start: OverlayPoint, end: OverlayPoint): OCRBoundingBox | null {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return width >= 0.02 && height >= 0.02 ? { x, y, width, height } : null;
}

function boxStyle(box: OCRBoundingBox): Record<string, string> {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  };
}

function regionStateClass(region: OCRRegion, selected: boolean, hovered: boolean): string {
  if (selected) return "border-primary bg-primary/20 shadow-[0_0_0_1px_rgba(199,146,79,0.3)]";
  if (hovered) return "border-primary/80 bg-primary/10";
  if (region.warnings.length > 0) return "border-red-400/90 bg-red-400/10";
  if (region.uncertainTokens.length > 0)
    return "border-dashed border-yellow-300/90 bg-yellow-300/10";
  if (region.confidence != null && region.confidence < 0.78) {
    return "border-yellow-400/90 bg-yellow-400/10";
  }
  if (region.kind === "math") return "border-dotted border-primary/90 bg-primary/5";
  return "border-primary/60 bg-primary/5";
}

function regionLabel(region: OCRRegion, isRu: boolean): string {
  const confidence = region.confidence == null ? "" : ` ${Math.round(region.confidence * 100)}%.`;
  return isRu
    ? `Регион ${region.order + 1}: ${region.kind}.${confidence}`
    : `Region ${region.order + 1}: ${region.kind}.${confidence}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
