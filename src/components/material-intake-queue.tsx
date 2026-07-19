import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Files,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { MaterialIntakeReviewDialog } from "@/components/material-intake-review-dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { formatFileSize } from "@/lib/document-ingestion";
import { isIntakeCancellation, throwIfIntakeCancelled } from "@/lib/intake-cancellation";
import {
  fingerprintFile,
  materialIdForFingerprint,
  rememberMaterialFingerprint,
} from "@/lib/material-fingerprints";
import {
  normalizeComparableFileName,
  normalizeComparableText,
  persistPreparedFile,
  prepareFileIntake,
  type MaterialIntakeOptions,
  type MaterialIntakeOutcome,
  type PreparedFileIntake,
} from "@/lib/material-intake";
import { uid, useData, type AppData, type MaterialType } from "@/lib/store";

export type MaterialQueueStatus =
  | "queued"
  | "extracting"
  | "duplicate"
  | "review"
  | "ready"
  | "partial"
  | "unsupported"
  | "error"
  | "cancelled"
  | "skipped";

type DuplicateDecision = "keep_both" | "replace";
type DuplicateMatch = "exact" | "likely";

interface QueueDuplicate {
  kind: "material" | "queue";
  match: DuplicateMatch;
  id: string;
  title: string;
  canReplace: boolean;
  reason: "fingerprint" | "content" | "metadata";
}

export interface MaterialReviewPatch {
  title: string;
  type: MaterialType;
  courseId?: string;
  topicId?: string;
  tags: string[];
}

export interface MaterialQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: MaterialQueueStatus;
  message?: string;
  materialId?: string;
  fingerprint?: string;
  prepared?: PreparedFileIntake;
  duplicate?: QueueDuplicate;
  duplicateDecision?: DuplicateDecision;
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
  resolveDuplicate: (id: string, action: "skip" | DuplicateDecision) => void;
  saveReview: (id: string, patch: MaterialReviewPatch) => void;
  retryReview: (id: string) => void;
  discardReview: (id: string) => void;
  clearFinished: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const MaterialIntakeQueueContext = createContext<MaterialIntakeQueueContextValue | null>(null);
const MAX_CONCURRENCY = 2;

export function MaterialIntakeQueueProvider({ children }: { children: ReactNode }) {
  const data = useData();
  const [items, setItems] = useState<MaterialQueueItem[]>([]);
  const [open, setOpen] = useState(false);
  const itemsRef = useRef(items);
  const dataRef = useRef(data);
  const runningRef = useRef(new Set<string>());
  const abortControllersRef = useRef(new Map<string, AbortController>());
  const fingerprintsInFlightRef = useRef(new Map<string, string>());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(
    () => () => {
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
    },
    [],
  );

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
    const controller = new AbortController();
    abortControllersRef.current.set(id, controller);
    const { signal } = controller;
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, status: "extracting", message: undefined }
          : candidate,
      ),
    );

    let ownedFingerprint: string | undefined;
    try {
      const fingerprint = item.fingerprint ?? (await fingerprintFile(item.file, signal));
      throwIfIntakeCancelled(signal);
      if (fingerprint && !item.duplicateDecision) {
        const exactDuplicate = findExactDuplicate(
          fingerprint,
          item,
          dataRef.current,
          itemsRef.current,
          fingerprintsInFlightRef.current,
        );
        if (exactDuplicate) {
          throwIfIntakeCancelled(signal);
          pauseForDuplicate(id, fingerprint, undefined, exactDuplicate, setItems);
          return;
        }
      }

      if (fingerprint && !item.duplicateDecision) {
        fingerprintsInFlightRef.current.set(fingerprint, id);
        ownedFingerprint = fingerprint;
      }

      const prepared = item.prepared ?? (await prepareFileIntake(item.file, { signal }));
      throwIfIntakeCancelled(signal);
      if (!item.duplicateDecision) {
        const likelyDuplicate = findLikelyDuplicate(
          prepared,
          item,
          dataRef.current,
          itemsRef.current,
        );
        if (likelyDuplicate) {
          throwIfIntakeCancelled(signal);
          pauseForDuplicate(id, fingerprint, prepared, likelyDuplicate, setItems);
          return;
        }
      }

      throwIfIntakeCancelled(signal);
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                status: "review",
                fingerprint,
                prepared,
                message: prepared.extraction.message,
              }
            : candidate,
        ),
      );
    } catch (error) {
      const cancelled = isIntakeCancellation(error, signal);
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                status: cancelled ? "cancelled" : "error",
                message: cancelled
                  ? "Processing cancelled."
                  : error instanceof Error
                    ? error.message
                    : String(error),
                prepared: cancelled ? undefined : candidate.prepared,
              }
            : candidate,
        ),
      );
    } finally {
      abortControllersRef.current.delete(id);
      runningRef.current.delete(id);
      if (ownedFingerprint && fingerprintsInFlightRef.current.get(ownedFingerprint) === id) {
        fingerprintsInFlightRef.current.delete(ownedFingerprint);
      }
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
        item.id === id
          ? {
              ...item,
              status: "queued",
              message: undefined,
              prepared: undefined,
              duplicate: undefined,
              duplicateDecision: undefined,
            }
          : item,
      ),
    );
    setOpen(true);
  }, []);

  const cancel = useCallback((id: string) => {
    abortControllersRef.current.get(id)?.abort();
    setItems((current) =>
      current.map((item) =>
        item.id === id && (item.status === "queued" || item.status === "extracting")
          ? { ...item, status: "cancelled", message: "Processing cancelled." }
          : item,
      ),
    );
  }, []);

  const remove = useCallback((id: string) => {
    if (runningRef.current.has(id)) return;
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const resolveDuplicate = useCallback<MaterialIntakeQueueContextValue["resolveDuplicate"]>(
    (id, action) => {
      setItems((current) =>
        current.map((item) => {
          if (item.id !== id || item.status !== "duplicate") return item;
          if (action === "skip") {
            return {
              ...item,
              status: "skipped",
              message: undefined,
              prepared: undefined,
              duplicateDecision: undefined,
            };
          }
          if (action === "replace" && !item.duplicate?.canReplace) return item;
          return {
            ...item,
            status: "queued",
            message: undefined,
            duplicateDecision: action,
          };
        }),
      );
      setOpen(true);
    },
    [],
  );

  const saveReview = useCallback<MaterialIntakeQueueContextValue["saveReview"]>((id, patch) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item?.prepared || item.status !== "review") return;
    try {
      const replaceMaterialId =
        item.duplicateDecision === "replace" && item.duplicate?.kind === "material"
          ? item.duplicate.id
          : undefined;
      const result = persistPreparedFile(item.prepared, {
        ...item.options,
        ...patch,
        existingMaterialId: replaceMaterialId ?? item.materialId,
      });
      rememberMaterialFingerprint(result.material.id, item.fingerprint);
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                status: queueStatusFromOutcome(result.outcome),
                message: result.message,
                materialId: result.material.id,
                options: { ...candidate.options, ...patch },
                prepared: undefined,
                duplicate: undefined,
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
    }
  }, []);

  const retryReview = useCallback((id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.status === "review"
          ? { ...item, status: "queued", prepared: undefined, message: undefined }
          : item,
      ),
    );
    setOpen(true);
  }, []);

  const discardReview = useCallback((id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.status === "review"
          ? { ...item, status: "skipped", prepared: undefined, message: undefined }
          : item,
      ),
    );
  }, []);

  const clearFinished = useCallback(() => {
    setItems((current) => current.filter((item) => isActiveStatus(item.status)));
  }, []);

  const value = useMemo<MaterialIntakeQueueContextValue>(
    () => ({
      items,
      enqueueFiles,
      retry,
      cancel,
      remove,
      resolveDuplicate,
      saveReview,
      retryReview,
      discardReview,
      clearFinished,
      open,
      setOpen,
    }),
    [
      items,
      enqueueFiles,
      retry,
      cancel,
      remove,
      resolveDuplicate,
      saveReview,
      retryReview,
      discardReview,
      clearFinished,
      open,
    ],
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
  const {
    items,
    retry,
    cancel,
    remove,
    resolveDuplicate,
    saveReview,
    retryReview,
    discardReview,
    clearFinished,
    open,
    setOpen,
  } = useMaterialIntakeQueue();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const isRu = lang === "ru";
  const activeCount = items.filter((item) => isActiveStatus(item.status)).length;
  const finishedCount = items.length - activeCount;
  const reviewItem = reviewId
    ? items.find((item) => item.id === reviewId && item.status === "review")
    : undefined;

  useEffect(() => {
    if (reviewId && !reviewItem) setReviewId(null);
  }, [reviewId, reviewItem]);

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
        <span className="rounded bg-background px-1.5 py-0.5 text-xs">
          {activeCount || items.length}
        </span>
        <ChevronUp className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      <section
        aria-label={isRu ? "Очередь загрузки материалов" : "Material upload queue"}
        className="fixed bottom-4 end-4 z-[80] w-[min(480px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold">
              <Files className="h-4 w-4 text-primary" />
              {isRu ? "Очередь материалов" : "Material queue"}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {items.some((item) => item.status === "duplicate")
                ? isRu
                  ? "Найдены возможные дубликаты — выбери действие"
                  : "Possible duplicates found — choose an action"
                : items.some((item) => item.status === "review")
                  ? isRu
                    ? "Материалы готовы к проверке"
                    : "Materials are ready for review"
                  : activeCount > 0
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

        <div className="max-h-[min(62svh,480px)] overflow-y-auto p-2">
          {items.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              isRu={isRu}
              onRetry={() => retry(item.id)}
              onCancel={() => cancel(item.id)}
              onRemove={() => remove(item.id)}
              onReview={() => setReviewId(item.id)}
              onDuplicateAction={(action) => resolveDuplicate(item.id, action)}
            />
          ))}
        </div>
      </section>

      <MaterialIntakeReviewDialog
        item={reviewItem}
        open={Boolean(reviewItem)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setReviewId(null);
        }}
        onSave={(patch) => {
          if (reviewItem) saveReview(reviewItem.id, patch);
        }}
        onRetry={() => {
          if (reviewItem) retryReview(reviewItem.id);
        }}
        onDiscard={() => {
          if (reviewItem) discardReview(reviewItem.id);
        }}
      />
    </>
  );
}

function QueueRow({
  item,
  isRu,
  onRetry,
  onCancel,
  onRemove,
  onReview,
  onDuplicateAction,
}: {
  item: MaterialQueueItem;
  isRu: boolean;
  onRetry: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onReview: () => void;
  onDuplicateAction: (action: "skip" | DuplicateDecision) => void;
}) {
  const status = queueStatusCopy(item.status, isRu);
  const canRetry = ["partial", "unsupported", "error"].includes(item.status);
  const canRemove = item.status !== "extracting";

  return (
    <div className="rounded-md border border-transparent px-2 py-2.5 hover:border-border hover:bg-background/50">
      <div className="flex items-start gap-3">
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
          {item.status === "review" && (
            <Button size="sm" variant="outline" onClick={onReview}>
              <Eye className="h-3.5 w-3.5 me-1" />
              {isRu ? "Проверить" : "Review"}
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
          {canRemove &&
            item.status !== "queued" &&
            item.status !== "duplicate" &&
            item.status !== "review" && (
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

      {item.status === "duplicate" && item.duplicate && (
        <div className="ms-10 mt-2 rounded-md border border-yellow-500/25 bg-yellow-500/5 p-2.5">
          <p className="text-xs text-foreground">
            {duplicateHeading(item.duplicate.match, isRu)}
            <strong>{item.duplicate.title}</strong>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {duplicateReasonCopy(item.duplicate.reason, isRu)}{" "}
            {isRu
              ? "Lamdan ничего не объединяет автоматически."
              : "Lamdan never merges sources automatically."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => onDuplicateAction("skip")}>
              {isRu ? "Пропустить" : "Skip"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDuplicateAction("keep_both")}>
              <Copy className="h-3.5 w-3.5 me-1" />
              {isRu ? "Сохранить обе" : "Keep both"}
            </Button>
            {item.duplicate.canReplace && (
              <Button size="sm" onClick={() => onDuplicateAction("replace")}>
                {isRu ? "Заменить источник" : "Replace source"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QueueStatusIcon({ status }: { status: MaterialQueueStatus }) {
  if (status === "extracting") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === "ready") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "review") return <Eye className="h-4 w-4 text-primary" />;
  if (status === "queued") return <Files className="h-4 w-4 text-muted-foreground" />;
  if (status === "cancelled" || status === "skipped") {
    return <X className="h-4 w-4 text-muted-foreground" />;
  }
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
    extracting: ["Проверяю и извлекаю", "Checking and extracting"],
    duplicate: ["Нужна проверка", "Needs review"],
    review: ["Готово к проверке", "Ready for review"],
    ready: ["Сохранено", "Saved"],
    partial: ["Сохранено частично", "Saved partially"],
    unsupported: ["Сохранено без текста", "Saved without text"],
    error: ["Ошибка", "Error"],
    cancelled: ["Отменено", "Cancelled"],
    skipped: ["Пропущено", "Skipped"],
  };
  return copy[status][isRu ? 0 : 1];
}

function isActiveStatus(status: MaterialQueueStatus): boolean {
  return (
    status === "queued" || status === "extracting" || status === "duplicate" || status === "review"
  );
}

function pauseForDuplicate(
  id: string,
  fingerprint: string | undefined,
  prepared: PreparedFileIntake | undefined,
  duplicate: QueueDuplicate,
  setItems: Dispatch<SetStateAction<MaterialQueueItem[]>>,
) {
  setItems((current) =>
    current.map((candidate) =>
      candidate.id === id
        ? {
            ...candidate,
            status: "duplicate",
            fingerprint,
            prepared,
            duplicate,
            message: undefined,
          }
        : candidate,
    ),
  );
}

function findExactDuplicate(
  fingerprint: string,
  currentItem: MaterialQueueItem,
  data: AppData,
  queueItems: MaterialQueueItem[],
  inFlight: Map<string, string>,
): QueueDuplicate | undefined {
  const indexedMaterialId = materialIdForFingerprint(fingerprint);
  if (indexedMaterialId && indexedMaterialId !== currentItem.materialId) {
    const material = data.materials.find((candidate) => candidate.id === indexedMaterialId);
    if (material) {
      return {
        kind: "material",
        match: "exact",
        id: material.id,
        title: material.title,
        canReplace: canSafelyReplaceMaterial(data, material.id),
        reason: "fingerprint",
      };
    }
  }

  const ownerId = inFlight.get(fingerprint);
  const queueDuplicate = queueItems.find(
    (candidate) =>
      candidate.id !== currentItem.id &&
      (candidate.id === ownerId || candidate.fingerprint === fingerprint) &&
      candidate.status !== "cancelled" &&
      candidate.status !== "skipped",
  );
  if (!queueDuplicate) return undefined;
  return {
    kind: "queue",
    match: "exact",
    id: queueDuplicate.id,
    title: queueDuplicate.name,
    canReplace: false,
    reason: "fingerprint",
  };
}

function findLikelyDuplicate(
  prepared: PreparedFileIntake,
  currentItem: MaterialQueueItem,
  data: AppData,
  queueItems: MaterialQueueItem[],
): QueueDuplicate | undefined {
  const comparableName = normalizeComparableFileName(prepared.fileName);
  const comparableText = normalizeComparableText(prepared.extraction.rawText);

  for (const material of data.materials) {
    if (material.id === currentItem.materialId) continue;
    const sameContent =
      comparableText.length >= 120 && normalizeComparableText(material.rawText) === comparableText;
    const sameMetadata =
      prepared.fileSize > 0 &&
      material.fileSize === prepared.fileSize &&
      normalizeComparableFileName(material.fileName || material.title) === comparableName;
    if (!sameContent && !sameMetadata) continue;
    return {
      kind: "material",
      match: "likely",
      id: material.id,
      title: material.title,
      canReplace: canSafelyReplaceMaterial(data, material.id),
      reason: sameContent ? "content" : "metadata",
    };
  }

  const queueDuplicate = queueItems.find((candidate) => {
    if (
      candidate.id === currentItem.id ||
      candidate.status === "cancelled" ||
      candidate.status === "skipped"
    ) {
      return false;
    }
    const sameMetadata =
      candidate.size === prepared.fileSize &&
      normalizeComparableFileName(candidate.name) === comparableName;
    const candidateText = candidate.prepared
      ? normalizeComparableText(candidate.prepared.extraction.rawText)
      : "";
    const sameContent =
      comparableText.length >= 120 &&
      candidateText.length >= 120 &&
      candidateText === comparableText;
    return sameContent || sameMetadata;
  });
  if (!queueDuplicate) return undefined;
  const sameContent =
    comparableText.length >= 120 &&
    queueDuplicate.prepared !== undefined &&
    normalizeComparableText(queueDuplicate.prepared.extraction.rawText) === comparableText;
  return {
    kind: "queue",
    match: "likely",
    id: queueDuplicate.id,
    title: queueDuplicate.name,
    canReplace: false,
    reason: sameContent ? "content" : "metadata",
  };
}

function canSafelyReplaceMaterial(data: AppData, materialId: string): boolean {
  return !(
    data.materialOutputs.some((output) => output.materialId === materialId) ||
    data.notes.some((note) => note.materialId === materialId) ||
    data.flashcards.some((card) => card.materialId === materialId) ||
    data.quizzes.some((quiz) => quiz.materialId === materialId) ||
    data.presentationOutlines.some((outline) => outline.materialId === materialId)
  );
}

function duplicateHeading(match: DuplicateMatch, isRu: boolean): string {
  if (match === "exact") return isRu ? "Точная копия: " : "Exact duplicate: ";
  return isRu ? "Возможная копия: " : "Possible duplicate: ";
}

function duplicateReasonCopy(reason: QueueDuplicate["reason"], isRu: boolean): string {
  const copy: Record<QueueDuplicate["reason"], [string, string]> = {
    fingerprint: ["Содержимое файла полностью совпадает.", "The file contents match exactly."],
    content: ["Извлечённый текст совпадает.", "The extracted text matches."],
    metadata: ["Совпадают имя и размер файла.", "The file name and size match."],
  };
  return copy[reason][isRu ? 0 : 1];
}
