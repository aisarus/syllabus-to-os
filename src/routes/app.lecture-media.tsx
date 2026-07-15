import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  FileAudio2,
  FileVideo2,
  HardDrive,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-context";
import { formatFileSize } from "@/lib/document-ingestion";
import { detectLongMediaKind, isLongMediaMaterial, validateLongMediaFile } from "@/lib/long-media";
import {
  deleteLongMediaData,
  putLongMediaFile,
  updateLongMediaDuration,
  type LongMediaWriteProgress,
} from "@/lib/long-media-store";
import { store, useData } from "@/lib/store";

export const Route = createFileRoute("/app/lecture-media")({
  component: LectureMediaPage,
});

function titleFromFile(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || name
  );
}

function readMediaDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const kind = detectLongMediaKind(file);
    if (!kind) {
      resolve(undefined);
      return;
    }
    const element = document.createElement(kind === "video" ? "video" : "audio");
    const url = URL.createObjectURL(file);
    const finish = (value?: number) => {
      URL.revokeObjectURL(url);
      element.removeAttribute("src");
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(undefined), 12_000);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish(
        Number.isFinite(element.duration) && element.duration > 0 ? element.duration : undefined,
      );
    };
    element.onerror = () => {
      window.clearTimeout(timer);
      finish(undefined);
    };
    element.src = url;
  });
}

function LectureMediaPage() {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const data = useData();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<LongMediaWriteProgress | null>(null);
  const mediaMaterials = data.materials.filter((material) => isLongMediaMaterial(material));

  const chooseFile = (next: File | undefined) => {
    if (!next) return;
    const validation = validateLongMediaFile(next);
    if (!validation.ok) {
      toast.error(isRu ? "Выбери аудио или видео до 4 ГБ." : validation.message);
      return;
    }
    setFile(next);
    setTitle(titleFromFile(next.name));
  };

  const upload = async () => {
    if (!file || !title.trim()) {
      toast.error(
        isRu ? "Выбери запись и укажи название." : "Choose a recording and enter a title.",
      );
      return;
    }
    const validation = validateLongMediaFile(file);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress(null);
    const durationPromise = readMediaDuration(file);
    const material = store.createMaterial({
      title: title.trim(),
      type: "lecture",
      sourceMode: "uploaded_file",
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      courseId: courseId || undefined,
      tags: ["long-media"],
      rawText: "",
      processingStatus: "no_text",
      processingMessage: isRu
        ? "Запись лекции сохраняется локально; расшифровка ещё не применена."
        : "Lecture recording is stored locally; no transcript has been applied yet.",
      wordCount: 0,
      charCount: 0,
      extractionMethod: "manual",
      sourceLanguage: "unknown",
    });

    let uploadSucceeded = false;
    try {
      const manifest = await putLongMediaFile(material.id, file, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      const duration = await durationPromise;
      if (duration) await updateLongMediaDuration(material.id, duration);
      store.updateMaterial(material.id, {
        processingMessage: isRu
          ? "Запись сохранена локально. Создай или импортируй расшифровку и подтверди source chunks."
          : "Recording saved locally. Create or import a transcript and approve source chunks.",
      });
      uploadSucceeded = true;
      toast.success(
        isRu
          ? `Лекция сохранена: ${manifest.chunkCount} локальных блоков`
          : `Lecture saved in ${manifest.chunkCount} local chunks`,
      );
    } catch (error) {
      await deleteLongMediaData(material.id).catch(() => undefined);
      store.deleteMaterial(material.id);
      if (error instanceof DOMException && error.name === "AbortError") {
        toast.info(
          isRu
            ? "Загрузка отменена. Неполная копия удалена."
            : "Upload cancelled. The incomplete copy was removed.",
        );
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setProgress(null);
    }

    if (!uploadSucceeded) return;
    try {
      await navigate({
        to: "/app/materials/$materialId",
        params: { materialId: material.id },
      });
    } catch {
      toast.warning(
        isRu
          ? "Лекция сохранена, но переход не открылся. Материал доступен в библиотеке."
          : "The lecture is saved, but its page did not open. It remains available in Materials.",
      );
    }
  };

  const progressPercent = progress
    ? Math.min(100, Math.round((progress.writtenBytes / Math.max(1, progress.totalBytes)) * 100))
    : 0;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <PageHeader
        title={isRu ? "Аудио и видео лекции" : "Audio and video lectures"}
        subtitle={
          isRu
            ? "Загружай целую пару одним файлом. Lamdan пишет её локально по 8 МБ, не читает всё видео в память и не отправляет запись внешнему ИИ без отдельного действия."
            : "Upload a full lecture as one file. Lamdan writes it locally in 8 MB chunks without reading the entire video into memory or sending it to external AI automatically."
        }
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-border bg-surface p-4 md:p-6">
          <div
            className="cursor-pointer rounded-xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center"
            onClick={() => !busy && inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!busy) chooseFile(event.dataTransfer.files?.[0]);
            }}
          >
            <Upload className="mx-auto h-8 w-8 text-primary" />
            <strong className="mt-3 block">
              {file
                ? file.name
                : isRu
                  ? "Выбери или перетащи запись пары"
                  : "Choose or drop a lecture recording"}
            </strong>
            <p className="mt-2 text-sm text-muted-foreground">
              {file
                ? `${formatFileSize(file.size)} · ${file.type || "unknown MIME"}`
                : isRu
                  ? "MP3, M4A, WAV, MP4, MOV, WebM и другие audio/video форматы · до 4 ГБ"
                  : "MP3, M4A, WAV, MP4, MOV, WebM and other audio/video formats · up to 4 GB"}
            </p>
          </div>
          <input
            ref={inputRef}
            hidden
            type="file"
            accept="audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.mp4,.m4v,.mov,.webm,.mkv"
            onChange={(event) => {
              chooseFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">
                {isRu ? "Название материала" : "Material title"}
              </label>
              <Input
                className="mt-1"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={
                  isRu ? "Лекция 4 — Конституционное право" : "Lecture 4 — Constitutional law"
                }
                disabled={busy}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{isRu ? "Курс" : "Course"}</label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                disabled={busy}
              >
                <option value="">{isRu ? "Без курса" : "No course"}</option>
                {data.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {progress ? (
            <div className="mt-5 rounded-lg border border-border bg-background p-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {isRu ? "Запись в IndexedDB" : "Writing to IndexedDB"}: {progress.completedChunks}
                  /{progress.totalChunks}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatFileSize(progress.writtenBytes)} / {formatFileSize(progress.totalBytes)}
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => void upload()} disabled={busy || !file || !title.trim()}>
              {busy ? (
                <Loader2 className="me-1 h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="me-1 h-4 w-4" />
              )}
              {isRu ? "Сохранить лекцию локально" : "Store lecture locally"}
            </Button>
            {busy ? (
              <Button variant="destructive" onClick={() => abortRef.current?.abort()}>
                {isRu ? "Отменить загрузку" : "Cancel upload"}
              </Button>
            ) : null}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <strong className="mt-2 block">{isRu ? "Что защищено" : "What is protected"}</strong>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {isRu
                ? "Новая версия файла становится активной только после записи всех блоков. При отмене или ошибке квоты staging-копия удаляется, а старая остаётся целой."
                : "A replacement becomes active only after every chunk is written. On cancellation or quota failure the staging copy is removed and the previous recording stays intact."}
            </p>
          </div>
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
            <AlertTriangle className="h-5 w-5 text-yellow-300" />
            <strong className="mt-2 block">
              {isRu ? "Граница текущей версии" : "Current boundary"}
            </strong>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {isRu
                ? "Сырой многогигабайтный файл пока не входит в Workspace ZIP: JSZip не подходит для потокового бэкапа таких объёмов. Метаданные материала и применённая расшифровка сохраняются в основном workspace; оригинал нужно хранить отдельно."
                : "The raw multi-gigabyte file is not yet included in Workspace ZIP because JSZip is not a streaming backup for this volume. Material metadata and applied transcript remain in the main workspace; keep the original separately."}
            </p>
          </div>
        </aside>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <h2 className="font-serif text-xl font-semibold">
          {isRu ? "Сохранённые записи" : "Stored recordings"}
        </h2>
        {mediaMaterials.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {isRu ? "Пока нет загруженных длинных лекций." : "No long lecture recordings yet."}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mediaMaterials.map((material) => {
              const Icon = material.mimeType?.startsWith("video/") ? FileVideo2 : FileAudio2;
              return (
                <Link
                  key={material.id}
                  to="/app/materials/$materialId"
                  params={{ materialId: material.id }}
                  className="rounded-lg border border-border bg-background p-4 transition hover:border-primary/50"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <strong className="mt-2 block break-words">{material.title}</strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {material.fileSize ? formatFileSize(material.fileSize) : "—"} ·{" "}
                    {material.processingStatus}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
