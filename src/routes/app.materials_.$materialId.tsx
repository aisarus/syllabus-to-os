import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpenCheck,
  ChevronDown,
  Cpu,
  History,
  ShieldCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { AutomaticTranscriptionPanel } from "@/components/automatic-transcription-panel";
import { LectureBackupPanel } from "@/components/lecture-backup-panel";
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
import "@/material-experience.css";

export const Route = createFileRoute("/app/materials_/$materialId")({
  component: MaterialDetail,
});

function MaterialDetail() {
  const { materialId } = Route.useParams();
  const { t, lang } = useApp();
  const data = useData();
  const navigate = useNavigate();
  const [transcriptRevision, setTranscriptRevision] = useState(0);
  const material = data.materials.find((item) => item.id === materialId);
  const isRu = lang === "ru";

  if (!material) {
    return (
      <div className="mx-auto max-w-6xl">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/materials" })}>
          <ArrowLeft className="h-4 w-4 me-1" />
          {t.back}
        </Button>
        <p className="mt-4 text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  const chunks = getChunksByMaterial(data, material.id);
  const longMedia = isLongMediaMaterial(material);
  const multiPageImage = isMultiPageImageMaterial(material);
  const visualMaterial = multiPageImage || material.mimeType?.startsWith("image/") === true;
  const hasProcessingWorkspace = longMedia || visualMaterial;
  const processingNeedsAttention =
    hasProcessingWorkspace &&
    (chunks.length === 0 || material.processingStatus !== "ready");
  const processingTitle = longMedia
    ? isRu
      ? "Расшифровка и резервная копия лекции"
      : "Lecture transcript and backup"
    : isRu
      ? "Страницы, изображения и OCR"
      : "Pages, images and OCR";
  const processingBody = longMedia
    ? isRu
      ? "Здесь находятся технические шаги подготовки источника: локальная копия, диапазоны, автоматическая расшифровка и проверка черновика."
      : "Technical source preparation lives here: local backup, ranges, automatic transcription and draft review."
    : isRu
      ? "Проверка изображения и распознанного текста отделена от чтения и работы с подтверждённым источником."
      : "Image and recognized-text review is separated from reading and working with the approved source.";

  const processingWorkspace = hasProcessingWorkspace ? (
    <ProcessingWorkspace
      eyebrow={isRu ? "Подготовка источника" : "Source preparation"}
      title={processingTitle}
      body={processingBody}
      initiallyOpen={processingNeedsAttention}
      status={
        processingNeedsAttention
          ? isRu
            ? "требует внимания"
            : "needs attention"
          : isRu
            ? "источник подготовлен"
            : "source prepared"
      }
    >
      {longMedia ? (
        <div className="material-processing__stack">
          <LectureBackupPanel key={`backup:${material.id}`} material={material} />
          <ResumableTranscriptionPanel
            key={`ranges:${material.id}`}
            material={material}
            onDraftApplied={() => setTranscriptRevision((current) => current + 1)}
          />
          <AutomaticTranscriptionPanel
            key={material.id}
            material={material}
            onDraftApplied={() => setTranscriptRevision((current) => current + 1)}
          />
          <LongMediaWorkspace
            key={`${material.id}:${transcriptRevision}`}
            material={material}
          />
        </div>
      ) : multiPageImage ? (
        <MultiPageImageWorkspace material={material} />
      ) : (
        <OCRReviewPanel material={material} />
      )}
    </ProcessingWorkspace>
  ) : null;

  return (
    <div className="material-experience">
      <div className="material-experience__workspace">
        <MaterialWorkspace material={material} />
      </div>

      <section className="material-study-pack" aria-labelledby="material-study-pack-title">
        <div className="material-study-pack__icon" aria-hidden="true">
          <BookOpenCheck size={22} />
        </div>
        <div className="material-study-pack__copy">
          <div className="material-experience__eyebrow">
            {isRu ? "Следующий учебный слой" : "Next study layer"}
          </div>
          <h2 id="material-study-pack-title">
            {isRu
              ? "Собрать занятие из подтверждённого источника"
              : "Build a session from the approved source"}
          </h2>
          <p>
            {longMedia && chunks.length === 0
              ? isRu
                ? "Сначала подтверди части расшифровки как source chunks. После этого Lamdan сможет собрать маршрут, конспект, термины, карточки и диагностический тест."
                : "Approve transcript blocks as source chunks first. Lamdan can then build a route, note, terms, flashcards and a diagnostic quiz."
              : isRu
                ? "Lamdan использует только выбранные подтверждённые фрагменты. Ты проверишь единый черновик до сохранения любого результата."
                : "Lamdan uses only selected approved chunks. You review one combined draft before anything is saved."}
          </p>
        </div>
        <div className="material-study-pack__action">
          <StudyPackButton
            materialId={material.id}
            courseId={material.courseId}
            topicId={material.topicId}
            initialChunkIds={chunks.map((chunk) => chunk.id)}
          />
        </div>
      </section>

      {processingWorkspace}

      <details className="material-history">
        <summary>
          <span className="material-history__icon" aria-hidden="true">
            <History size={18} />
          </span>
          <span>
            <strong>
              {isRu ? "История созданных результатов" : "Created output history"}
            </strong>
            <small>
              {isRu
                ? "Сохранённые конспекты, карточки, тесты и другие результаты по этому источнику."
                : "Saved notes, flashcards, quizzes and other outputs from this source."}
            </small>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="material-history__body">
          <MaterialOutputHistory material={material} />
        </div>
      </details>
    </div>
  );
}

function ProcessingWorkspace({
  eyebrow,
  title,
  body,
  status,
  initiallyOpen,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  status: string;
  initiallyOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <details
      className="material-processing"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="material-processing__icon" aria-hidden="true">
          <Cpu size={19} />
        </span>
        <span className="material-processing__copy">
          <span className="material-experience__eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
          <small>{body}</small>
        </span>
        <span className="material-processing__status">
          <ShieldCheck size={13} />
          {status}
        </span>
        <ChevronDown
          className="material-processing__chevron"
          size={18}
          aria-hidden="true"
        />
      </summary>
      <div className="material-processing__body">{children}</div>
    </details>
  );
}
