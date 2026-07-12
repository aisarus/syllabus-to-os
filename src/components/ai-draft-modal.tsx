import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import type { ReactNode } from "react";
import { toast } from "sonner";

export type AIDraftState = "idle" | "loading" | "error" | "ready" | "saved";

export interface AIDraftSource {
  id: string;
  title: string;
}

interface AIDraftModalProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  state: AIDraftState;
  error?: string;
  warnings?: string[];
  sourceChunks?: AIDraftSource[];
  onSave?: () => void;
  saveDisabled?: boolean;
  onRegenerate?: () => void;
  copyText?: string;
  dirty?: boolean;
  children?: ReactNode;
}

export function AIDraftModal(props: AIDraftModalProps) {
  const { t, lang } = useApp();
  const {
    open,
    onOpenChange,
    title,
    state,
    error,
    warnings,
    sourceChunks,
    onSave,
    saveDisabled,
    onRegenerate,
    copyText,
    dirty,
    children,
  } = props;
  const isRu = lang === "ru";

  const doCopy = () => {
    if (!copyText) return;
    navigator.clipboard.writeText(copyText).then(
      () => toast.success(t.copied),
      () => toast.error(t.copyFailed),
    );
  };

  const requestClose = () => {
    if (dirty && state === "ready") {
      const confirmed = confirm(
        isRu
          ? "Закрыть и потерять несохранённые изменения черновика?"
          : "Close and discard the unsaved draft changes?",
      );
      if (!confirmed) return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
        else requestClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
              AI
            </span>
            {title}
            {state === "ready" && dirty && (
              <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-normal text-yellow-200">
                {isRu ? "Есть несохранённые изменения" : "Unsaved changes"}
              </span>
            )}
            {state === "saved" && (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-normal text-emerald-300">
                {isRu ? "Сохранено" : "Saved"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {state === "loading" && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            {t.aiThinking}
          </div>
        )}

        {state === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <div className="font-medium text-destructive">{t.aiError}</div>
                <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                  {error || t.aiError}
                </div>
              </div>
            </div>
          </div>
        )}

        {state === "saved" && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
              <div>
                <div className="font-medium text-emerald-200">
                  {isRu ? "Результат сохранён" : "Output saved"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isRu
                    ? "Черновик сохранён ровно один раз и связан с выбранными источниками."
                    : "The draft was saved exactly once and remains linked to the selected sources."}
                </p>
              </div>
            </div>
          </div>
        )}

        {state === "ready" && (
          <div className="space-y-3">
            {warnings && warnings.length > 0 && (
              <div className="space-y-1 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs">
                <div className="font-medium text-yellow-300">{t.aiWarnings}</div>
                <ul className="list-disc ps-5 text-muted-foreground">
                  {warnings.map((warning, index) => (
                    <li key={`${warning}_${index}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {children}
            {sourceChunks && sourceChunks.length > 0 && (
              <div className="rounded-md border border-border bg-surface p-2 text-xs">
                <div className="mb-1 text-muted-foreground">
                  {t.aiSources} ({sourceChunks.length})
                </div>
                <ul className="space-y-0.5">
                  {sourceChunks.map((source) => (
                    <li key={source.id} className="truncate" title={source.id}>
                      · {source.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {state === "ready" && copyText && (
            <Button variant="ghost" size="sm" onClick={doCopy}>
              <Copy className="h-3.5 w-3.5 me-1" />
              {t.copy}
            </Button>
          )}
          {(state === "ready" || state === "error") && onRegenerate && (
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RefreshCw className="h-3.5 w-3.5 me-1" />
              {t.aiRegenerate}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={requestClose}>
            {state === "saved" ? t.close : t.cancel}
          </Button>
          {state === "ready" && onSave && (
            <Button onClick={onSave} disabled={saveDisabled}>
              {t.save}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
