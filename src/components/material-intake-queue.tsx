import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Files,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { formatFileSize } from "@/lib/document-ingestion";
import {
  intakeFile,
  type MaterialIntakeOptions,
  type MaterialIntakeOutcome,
} from "@/lib/material-intake";
import { uid } from "@/lib/store";

export type MaterialQueueStatus =
  | "queued"
  | "extracting"
  | "ready"
  | "partial"
  | "unsupported"
  | "error"
  | "cancelled";

export interface MaterialQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: MaterialQueueStatus;
  message?: string;
  materialId?: string;
  options: Omit<MaterialIntakeOptions, "existingMaterialId">;
}

interface MaterialIntakeQueueContextValue {
  items: MaterialQueueItem[];
  enqueueFiles: (
    files: Iterable<File>,
    options?: Omit<MaterialIntakeOptions, "existingMaterialId">,
  ) => void;
  retry: (id: string) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const MaterialIntakeQueueContext = createContext<MaterialIntakeQueueContextValue | null>(null);
const MAX_CONCURRENCY = 2;

export function MaterialIntakeQueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<MaterialQueueItem[]>([]);
  const [open, setOpen] = useState(false);
  const itemsRef = useRef(items);
  const runningRef = useRef(new Set<string>());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const enqueueFiles = useCallback<MaterialIntakeQueueContextValue["enqueueFiles"]>(
    (files, options = {}) => {
      const next = Array.from(files).map<MaterialQueueItem>((file) => ({
        id: uid("queue"),
        file,
        name: file.name,
        size: file.size,
        status: "queued",
        options: { ...options },
      }));
      if (next.length === 0) return;
      setItems((current) => [...current, ...next]);
      setOpen(true);
    },
    [],
  );

  const processItem = useCallback(async (id: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item || item.status !== "queued" || runningRef.current.has(id)) return;

    runningRef.current.add(id);
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, status: "extracting", message: undefined }
          : candidate,
      ),
    );

    try {
      const result = await intakeFile(item.file, {
        ...item.options,
        existingMaterialId: item.materialId,
      });
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                status: queueStatusFromOutcome(result.outcome),
                message: result.message,
                materialId: result.material.id,
              }
            : candidate,
        ),
      );
    } catch (error) {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                status: "error",
                message: error instanceof Error ? error.message : String(error),
              }
            : candidate,
        ),
      );
    } finally {
      runningRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const available = Math.max(0, MAX_CONCURRENCY - runningRef.current.size);
    if (available === 0) return;
    items
      .filter((item) => item.status === "queued" && !runningRef.current.has(item.id))
      .slice(0, available)
      .forEach((item) => void processItem(item.id));
  }, [items, processItem]);

  const retry = useCallback((id: string) => {
    if (runningRef.current.has(id)) return;
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: "queued", message: undefined } : item,
      ),
    );
    setOpen(true);
  }, []);

  const cancel = useCallback((id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.status === "queued" ? { ...item, status: "cancelled" } : item,
      ),
    );
  }, []);

  const remove = useCallback((id: string) => {
    if (runningRef.current.has(id)) return;
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setItems((current) =>
      current.filter((item) => item.status === "queued" || item.status === "extracting"),
    );
  }, []);

  const value = useMemo<MaterialIntakeQueueContextValue>(
    () => ({
      items,
      enqueueFiles,
      retry,
      cancel,
      remove,
      clearFinished,
      open,
      setOpen,
    }),
    [items, enqueueFiles, retry, cancel, remove, clearFinished, open],
  );

  return (
    <MaterialIntakeQueueContext.Provider value={value}>
      {children}
      <MaterialIntakeQueuePanel />
    </MaterialIntakeQueueContext.Provider>
  );
}

export function useMaterialIntakeQueue(): MaterialIntakeQueueContextValue {
  const context = useContext(MaterialIntakeQueueContext);
  if (!context) {
    throw new Error("useMaterialIntakeQueue must be used inside MaterialIntakeQueueProvider");
  }
  return context;
}

function MaterialIntakeQueuePanel() {
  const { lang } = useApp();
  const { items, retry, cancel, remove, clearFinished, open, setOpen } =
    useMaterialIntakeQueue();
  const isRu = lang === "ru";
  const activeCount = items.filter(
    (item) => item.status === "queued" || item.status === "extracting",
  ).length;
  const finishedCount = items.length - activeCount;

  if (items.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="fixed bottom-4 end-4 z-[80] inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Files className="h-4 w-4 text-primary" />
        {isRu ? "Загрузка материалов" : "Material intake"}
        <span className="rounded bg-background px-1.5 py-0.5 text-xs">{activeCount || items.length}</span>
        <ChevronUp className="h-4 w-4" />
      </button>
    );
  }

  return (
    <section
      aria-label={isRu ? "Очередь загрузки материалов" : "Material upload queue"}
      className="fixed bottom-4 end-4 z-[80] w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            <Files className="h-4 w-4 text-primary" />
            {isRu ? "Очередь материалов" : "Material queue"}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {activeCount > 0
              ? isRu
                ? `Обрабатывается: ${activeCount}`
                : `Processing: ${activeCount}`
              : isRu
                ? "Обработка завершена"
                : "Processing complete"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {finishedCount > 0 && (
            <Button size="sm" variant="ghost" onClick={clearFinished}>
              {isRu ? "Очистить" : "Clear"}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label={isRu ? "Свернуть очередь" : "Collapse queue"}
            onClick={() => setOpen(false)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="max-h-[min(58svh,420px)] overflow-y-auto p-2">
        {items.map((item) => (
          <QueueRow
            key={item.id}
            item={item}
            isRu={isRu}
            onRetry={() => retry(item.id)}
            onCancel={() => cancel(item.id)}
            onRemove={() => remove(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

function QueueRow({
  item,
  isRu,
  onRetry,
  onCancel,
  onRemove,
}: {
  item: MaterialQueueItem;
  isRu: boolean;
  onRetry: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const status = queueStatusCopy(item.status, isRu);
  const canRetry = ["partial", "unsupported", "error"].includes(item.status);
  const canRemove = item.status !== "extracting";

  return (
    <div className="flex items-start gap-3 rounded-md border border-transparent px-2 py-2.5 hover:border-border hover:bg-background/50">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded border border-border bg-background">
        <QueueStatusIcon status={item.status} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium" title={item.name}>
          {item.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>{formatFileSize(item.size)}</span>
          <span>{status}</span>
        </div>
        {item.message && (
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.message}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.status === "queued" && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={isRu ? "Отменить" : "Cancel"}
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        {canRetry && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={isRu ? "Повторить" : "Retry"}
            onClick={onRetry}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        {canRemove && item.status !== "queued" && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={isRu ? "Убрать из очереди" : "Remove from queue"}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function QueueStatusIcon({ status }: { status: MaterialQueueStatus }) {
  if (status === "extracting") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === "ready") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "queued") return <Files className="h-4 w-4 text-muted-foreground" />;
  if (status === "cancelled") return <X className="h-4 w-4 text-muted-foreground" />;
  return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
}

function queueStatusFromOutcome(outcome: MaterialIntakeOutcome): MaterialQueueStatus {
  switch (outcome) {
    case "success":
      return "ready";
    case "partial":
      return "partial";
    case "unsupported":
      return "unsupported";
    case "error":
      return "error";
  }
}

function queueStatusCopy(status: MaterialQueueStatus, isRu: boolean): string {
  const copy: Record<MaterialQueueStatus, [string, string]> = {
    queued: ["В очереди", "Queued"],
    extracting: ["Извлекаю текст", "Extracting"],
    ready: ["Готово", "Ready"],
    partial: ["Частично", "Partial"],
    unsupported: ["Не поддерживается", "Unsupported"],
    error: ["Ошибка", "Error"],
    cancelled: ["Отменено", "Cancelled"],
  };
  return copy[status][isRu ? 0 : 1];
}
