import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Copy, AlertCircle } from "lucide-react";
import { useApp } from "@/lib/app-context";
import type { ReactNode } from "react";
import { toast } from "sonner";

export type AIDraftState = "idle" | "loading" | "error" | "ready";

export interface AIDraftSource { id: string; title: string }

interface AIDraftModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  state: AIDraftState;
  error?: string;
  warnings?: string[];
  sourceChunks?: AIDraftSource[];
  onSave?: () => void;
  saveDisabled?: boolean;
  onRegenerate?: () => void;
  copyText?: string;
  children?: ReactNode;
}

export function AIDraftModal(props: AIDraftModalProps) {
  const { t } = useApp();
  const {
    open, onOpenChange, title, state, error, warnings,
    sourceChunks, onSave, saveDisabled, onRegenerate, copyText, children,
  } = props;

  const doCopy = () => {
    if (!copyText) return;
    navigator.clipboard.writeText(copyText).then(
      () => toast.success(t.copied),
      () => toast.error(t.copyFailed),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex items-center rounded bg-primary/15 text-primary text-[10px] px-1.5 py-0.5">AI</span>
            {title}
          </DialogTitle>
        </DialogHeader>

        {state === "loading" && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
            {t.aiThinking}
          </div>
        )}

        {state === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
              <div>
                <div className="font-medium text-destructive">{t.aiError}</div>
                <div className="text-muted-foreground text-xs mt-1 whitespace-pre-wrap">{error || t.aiError}</div>
              </div>
            </div>
          </div>
        )}

        {state === "ready" && (
          <div className="space-y-3">
            {warnings && warnings.length > 0 && (
              <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs space-y-1">
                <div className="font-medium text-yellow-300">{t.aiWarnings}</div>
                <ul className="list-disc ps-5 text-muted-foreground">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            {children}
            {sourceChunks && sourceChunks.length > 0 && (
              <div className="rounded-md border border-border bg-surface p-2 text-xs">
                <div className="text-muted-foreground mb-1">{t.aiSources} ({sourceChunks.length})</div>
                <ul className="space-y-0.5">
                  {sourceChunks.map((s) => (
                    <li key={s.id} className="truncate">· {s.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {state === "ready" && copyText && (
            <Button variant="ghost" size="sm" onClick={doCopy}>
              <Copy className="h-3.5 w-3.5 me-1" />{t.copy}
            </Button>
          )}
          {(state === "ready" || state === "error") && onRegenerate && (
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RefreshCw className="h-3.5 w-3.5 me-1" />{t.aiRegenerate}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          {state === "ready" && onSave && (
            <Button onClick={onSave} disabled={saveDisabled}>{t.save}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
