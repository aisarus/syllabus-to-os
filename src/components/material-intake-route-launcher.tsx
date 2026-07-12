import { useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMaterialIntakeQueue } from "@/components/material-intake-queue";
import { useApp } from "@/lib/app-context";

export function MaterialIntakeRouteLauncher() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { lang } = useApp();
  const { enqueueFiles } = useMaterialIntakeQueue();
  const inputRef = useRef<HTMLInputElement>(null);

  if (pathname !== "/app/materials") return null;

  return (
    <div className="mx-auto mb-3 flex max-w-6xl justify-end">
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.json,.html,.xml,.yaml,.yml"
        onChange={(event) => {
          if (event.target.files?.length) enqueueFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <FileUp className="h-4 w-4 me-1" />
        {lang === "ru" ? "Загрузить несколько файлов" : "Upload multiple files"}
      </Button>
    </div>
  );
}
