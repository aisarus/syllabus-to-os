import { useRouterState } from "@tanstack/react-router";
import { AlertTriangle, HardDrive, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { formatFileSize } from "@/lib/document-ingestion";
import {
  clearAllLongMediaData,
  getLongMediaStorageStats,
  type LongMediaStorageStats,
} from "@/lib/long-media-store";

export function LongMediaDataBoundary() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { lang } = useApp();
  const isRu = lang === "ru";
  const [stats, setStats] = useState<LongMediaStorageStats | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStats(await getLongMediaStorageStats());
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    if (pathname === "/app/data") void refresh();
  }, [pathname, refresh]);

  if (pathname !== "/app/data") return null;

  const clearMedia = async () => {
    if (
      !confirm(
        isRu
          ? "Удалить все локальные аудио/видеофайлы и черновики их расшифровок? Core-материалы и уже применённые source chunks останутся."
          : "Delete every local audio/video file and transcript draft? Core materials and already applied source chunks will remain.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await clearAllLongMediaData();
      await refresh();
      toast.success(isRu ? "Локальные записи лекций удалены" : "Local lecture recordings deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto mb-4 max-w-4xl rounded-lg border border-orange-500/35 bg-orange-500/5 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-200" />
          <div>
            <h2 className="text-sm font-semibold text-orange-100">
              {isRu
                ? "Длинные аудио/видеозаписи — отдельный локальный слой"
                : "Long audio/video recordings are a separate local layer"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isRu
                ? "Workspace ZIP v2 пока не включает сырой многогигабайтный файл и редактируемый transcript draft. В ZIP входят core-метаданные материала и уже применённые source chunks. Храни оригинальную запись отдельно."
                : "Workspace ZIP v2 does not yet contain the raw multi-gigabyte file or editable transcript draft. It does contain core material metadata and already applied source chunks. Keep the original recording separately."}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              {stats
                ? `${stats.mediaCount} ${isRu ? "записей" : "recordings"} · ${stats.transcriptCount} transcript drafts · ${formatFileSize(stats.totalBytes)}`
                : isRu
                  ? "Статистика long-media IndexedDB недоступна"
                  : "Long-media IndexedDB statistics are unavailable"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void clearMedia()}
          disabled={busy || !stats?.mediaCount}
        >
          {busy ? (
            <Loader2 className="me-1 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="me-1 h-4 w-4" />
          )}
          {isRu ? "Удалить только записи" : "Delete recordings only"}
        </Button>
      </div>
    </section>
  );
}
