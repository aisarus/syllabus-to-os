import { useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { FileImage, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMaterialIntakeQueue } from "@/components/material-intake-queue";
import { useApp } from "@/lib/app-context";
import { createMultiPageImageMaterial } from "@/lib/multi-page-image-materials";

export function MaterialIntakeRouteLauncher() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { lang } = useApp();
  const { enqueueFiles } = useMaterialIntakeQueue();
  const inputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const isRu = lang === "ru";

  if (pathname !== "/app/materials") return null;

  const createBatch = async (files: FileList | null) => {
    if (!files?.length) return;
    if (files.length < 2) {
      enqueueFiles(files);
      return;
    }
    setCreatingBatch(true);
    try {
      const result = await createMultiPageImageMaterial(Array.from(files));
      if (result.skippedDuplicates.length > 0) {
        toast.warning(
          isRu
            ? `Пропущены дубликаты: ${result.skippedDuplicates.join(", ")}`
            : `Duplicates skipped: ${result.skippedDuplicates.join(", ")}`,
        );
      }
      toast.success(
        isRu
          ? `Создан фотоматериал: ${result.addedPages.length} страниц`
          : `Image material created: ${result.addedPages.length} pages`,
      );
      await navigate({
        to: "/app/materials/$materialId",
        params: { materialId: result.material.id },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingBatch(false);
    }
  };

  return (
    <div className="mx-auto mb-3 flex max-w-6xl flex-wrap justify-end gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.json,.html,.xml,.yaml,.yml,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        onChange={(event) => {
          if (event.target.files?.length) enqueueFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={batchInputRef}
        type="file"
        multiple
        hidden
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        onChange={(event) => {
          void createBatch(event.target.files);
          event.target.value = "";
        }}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <FileUp className="h-4 w-4 me-1" />
        {isRu ? "Отдельные файлы или фото" : "Separate files or photos"}
      </Button>
      <Button
        onClick={() => batchInputRef.current?.click()}
        disabled={creatingBatch}
        title={
          isRu
            ? "Выбранные фотографии станут страницами одного материала"
            : "Selected photos become pages of one material"
        }
      >
        {creatingBatch ? (
          <Loader2 className="h-4 w-4 me-1 animate-spin" />
        ) : (
          <FileImage className="h-4 w-4 me-1" />
        )}
        {isRu ? "Несколько фото → один материал" : "Multiple photos → one material"}
      </Button>
    </div>
  );
}
