import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { exportJSON, importJSON, store } from "@/lib/store";
import { Download, Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/data")({
  component: DataPage,
});

function DataPage() {
  const { t } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const doExport = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lamdan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    setErr(null);
    const reader = new FileReader();
    reader.onload = () => {
      const res = importJSON(String(reader.result));
      if (res.ok) {
        toast.success(t.importSuccess);
      } else {
        setErr(res.error);
        toast.error(t.invalidFile);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title={t.dataTitle} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-semibold mb-2">{t.export}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t.exportDesc}</p>
          <Button onClick={doExport}>
            <Download className="h-4 w-4 me-1" />
            {t.export}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-semibold mb-2">{t.import}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t.importDesc}</p>
          <input
            ref={ref}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) doImport(file);
              e.target.value = "";
            }}
          />
          <Button onClick={() => ref.current?.click()}>
            <Upload className="h-4 w-4 me-1" />
            {t.importFile}
          </Button>
          {err && <p className="text-xs text-destructive mt-2">{err}</p>}
        </div>
        <div className="rounded-lg border border-destructive/40 bg-surface p-6 md:col-span-2">
          <h2 className="font-semibold mb-2">{t.clearAll}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t.clearConfirm}</p>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(t.clearConfirm)) store.reset();
            }}
          >
            <Trash2 className="h-4 w-4 me-1" />
            {t.clearAll}
          </Button>
        </div>
      </div>
    </div>
  );
}
