import { Link } from "@tanstack/react-router";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import {
  WorkspacePersistenceError,
  inspectWorkspacePersistence,
  persistWorkspaceSnapshot,
  type WorkspacePersistenceHealth,
} from "@/lib/persistence-health";
import { repairDanglingSourceReferences } from "@/lib/source-integrity";
import {
  retryPendingWorkspacePersistence,
  updateData,
  useData,
  useWorkspacePersistenceFailure,
  type AppData,
} from "@/lib/store";

/**
 * Keeps the legacy local-first store honest without changing its persisted v1
 * schema. The component detects failed localStorage writes and repairs citations
 * after older chunk-editing paths replace source ids.
 */
export function StoreSafetyLifecycle() {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const pendingFailure = useWorkspacePersistenceFailure();
  const previousRef = useRef<AppData | null>(null);
  const applyingRepairRef = useRef(false);
  const [health, setHealth] = useState<WorkspacePersistenceHealth | null>(null);

  useEffect(() => {
    const previous = previousRef.current;
    if (!previous) {
      previousRef.current = data;
      return;
    }
    if (applyingRepairRef.current) {
      applyingRepairRef.current = false;
      previousRef.current = data;
      return;
    }

    const repair = repairDanglingSourceReferences(previous, data);
    if (repair.changed) {
      applyingRepairRef.current = true;
      previousRef.current = repair.data;
      try {
        updateData(() => repair.data);
        console.info("Lamdan repaired source references", {
          remapped: Object.keys(repair.remappedIds).length,
          removed: repair.removedReferenceCount,
        });
      } catch (error) {
        if (!(error instanceof WorkspacePersistenceError)) throw error;
      }
      return;
    }
    previousRef.current = data;
  }, [data]);

  useEffect(() => {
    setHealth(inspectWorkspacePersistence(data));
  }, [data]);

  const visibleHealth = pendingFailure?.health ?? health;
  if (!visibleHealth || visibleHealth.ok) return null;

  const retry = () => {
    const retried = retryPendingWorkspacePersistence();
    setHealth(retried ?? persistWorkspaceSnapshot(data));
  };
  const exportEmergencyCopy = () => downloadEmergencyJSON(visibleHealth.serialized);

  return (
    <section
      role="alert"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <strong className="block">
            {isRu
              ? "Изменение не применено: браузер не подтвердил сохранение"
              : "Change not applied: browser storage did not confirm the save"}
          </strong>
          <p className="mt-1 text-xs leading-5 text-red-100/80">
            {isRu
              ? "Текущий сохранённый workspace не изменён. Черновик неудачной операции хранится в памяти этой вкладки: скачай копию или освободи место и повтори сохранение."
              : "The current saved workspace is unchanged. The failed operation remains as an in-tab recovery candidate: download it or free storage and retry."}
          </p>
          {visibleHealth.error && (
            <p className="mt-1 break-words text-[11px] text-red-100/70">{visibleHealth.error}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={retry}>
          <RefreshCw className="h-4 w-4 me-1" />
          {isRu ? "Повторить" : "Retry"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={exportEmergencyCopy}
          disabled={!visibleHealth.serialized}
        >
          <Download className="h-4 w-4 me-1" />
          {isRu ? "Аварийная JSON-копия" : "Emergency JSON"}
        </Button>
        <Link
          to="/app/data"
          className="inline-flex h-9 items-center rounded-md px-3 text-xs font-medium underline underline-offset-4"
        >
          {isRu ? "Управление данными" : "Data management"}
        </Link>
      </div>
    </section>
  );
}

function downloadEmergencyJSON(serialized: string): void {
  const blob = new Blob([JSON.stringify(JSON.parse(serialized), null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lamdan-emergency-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
