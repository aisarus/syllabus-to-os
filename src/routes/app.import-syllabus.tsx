import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { SyllabusReviewWorkspace } from "@/components/syllabus-review-workspace";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/app/import-syllabus")({
  component: ImportSyllabusPage,
});

function ImportSyllabusPage() {
  const { lang } = useApp();
  const isRu = lang === "ru";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={isRu ? "Импорт силлабуса" : "Import syllabus"}
        subtitle={
          isRu
            ? "Загрузи документ, проверь каждое извлечённое поле и только потом создай или обнови курс."
            : "Upload a document, review every extracted field, and only then create or update a course."
        }
      />
      <SyllabusReviewWorkspace />
    </div>
  );
}
