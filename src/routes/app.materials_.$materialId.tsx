import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpenCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { AutomaticTranscriptionPanel } from "@/components/automatic-transcription-panel";
import { LocalRangeExtractionPanel } from "@/components/local-range-extraction-panel";
import { LongMediaWorkspace } from "@/components/long-media-workspace";
import { MaterialOutputHistory } from "@/components/material-output-history";
import { MaterialWorkspace } from "@/components/material-workspace";
import { MultiPageImageWorkspace } from "@/components/multi-page-image-workspace";
import { OCRReviewPanel } from "@/components/ocr-review-panel";
import { ResumableTranscriptionPanel } from "@/components/resumable-transcription-panel";
import { StudyPackButton } from "@/components/study-pack-dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { isLongMediaMaterial } from "@/lib/long-media";
import { isMultiPageImageMaterial } from "@/lib/multi-page-image-materials";
import { getChunksByMaterial, useData } from "@/lib/store";

export const Route = createFileRoute("/app/materials_/$materialId")({
  component: MaterialDetail,
});

function MaterialDetail() {
  const { materialId } = Route.useParams();
  const { t, lang } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const [transcriptRevision, setTranscriptRevision] = useState(0);
  const [rangeQueueRevision, setRangeQueueRevision] = useState(0);
  const material = data.materials.find((item) => item.id === materialId);
  const isRu = lang === "ru";
  const refreshRangeQueue = useCallback(() => {
    setRangeQueueRevision((current) => current + 1);
  }, []);

  if (!material) {
    return (
      <div className="mx-auto max-w-6xl">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/materials" })}>
          <ArrowLeft className="me-1 h-4 w-4" />
          {t.back}
        </Button>
        <p className="mt-4 text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  const chunks = getChunksByMaterial(data, material.id);
  const longMedia = isLongMediaMaterial(material);

  return (
    <>
      <div className="mx-auto mb-4 max-w-[1440px] rounded-lg border border-primary/25 bg-primary/5 p-4 md:flex md:items-center md:justify-between md:gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookOpenCheck className="h-4 w-4 text-primary" />
            {isRu ? "Учебный комплект по материалу" : "Guided Study Pack"}
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            {longMedia && chunks.length === 0
              ? isRu
                ? "Сначала подтверди части расшифровки как source chunks. После этого Lamdan сможет собрать конспект, термины, карточки и диагностический тест."
                : "Approve transcript blocks as source chunks first. Lamdan can then build a note, terms, flashcards and a diagnostic quiz."
              : isRu
                ? "Lamdan соберёт из подтверждённых фрагментов готовое занятие: маршрут, конспект, термины, карточки и диагностический тест. Сначала ты проверишь единый черновик."
                : "Lamdan turns approved chunks into one guided session: route, note, terms, flashcards and a diagnostic quiz. You review one combined draft before anything is saved."}
          </p>
        </div>
        <div className="mt-3 shrink-0 md:mt-0 md:w-72">
          <StudyPackButton
            materialId={material.id}
            courseId={material.courseId}
            topicId={material.topicId}
            initialChunkIds={chunks.map((chunk) => chunk.id)}
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1440px]">
        {longMedia ? (
          <>
            <ResumableTranscriptionPanel
              key={`ranges:${material.id}:${rangeQueueRevision}`}
              material={material}
              onDraftApplied={() => setTranscriptRevision((current) => current + 1)}
            />
            <LocalRangeExtractionPanel
              key={`local-ranges:${material.id}:${rangeQueueRevision}`}
              material={material}
              onQueueChanged={refreshRangeQueue}
              onDraftApplied={() => setTranscriptRevision((current) => current + 1)}
            />
            <AutomaticTranscriptionPanel
              key={material.id}
              material={material}
              onDraftApplied={() => setTranscriptRevision((current) => current + 1)}
            />
            <LongMediaWorkspace key={`${material.id}:${transcriptRevision}`} material={material} />
          </>
        ) : isMultiPageImageMaterial(material) ? (
          <MultiPageImageWorkspace material={material} />
        ) : (
          <OCRReviewPanel material={material} />
        )}
      </div>
      <MaterialWorkspace material={material} />
      <div className="mx-auto max-w-[1440px]">
        <MaterialOutputHistory material={material} />
      </div>
    </>
  );
}
