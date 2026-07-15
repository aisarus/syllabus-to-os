import {
  AlertTriangle,
  Check,
  Clock3,
  FileAudio2,
  FileVideo2,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { formatFileSize } from "@/lib/document-ingestion";
import {
  buildTranscriptSegments,
  formatMediaTime,
  parseTimedTranscript,
  transcriptToMaterialChunks,
  validateLongMediaFile,
  type LongMediaManifest,
  type LongMediaTranscriptDraft,
  type TranscriptSegmentDraft,
} from "@/lib/long-media";
import {
  getLongMediaBlob,
  getLongMediaManifest,
  getLongMediaTranscript,
  putLongMediaFile,
  putLongMediaTranscript,
  updateLongMediaDuration,
  verifyLongMediaIntegrity,
  type LongMediaWriteProgress,
} from "@/lib/long-media-store";
import { store, type Material } from "@/lib/store";

export function LongMediaWorkspace({ material }: { material: Material }) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [manifest, setManifest] = useState<LongMediaManifest | undefined>();
  const [transcript, setTranscript] = useState<LongMediaTranscriptDraft | undefined>();
  const [loading, setLoading] = useState(true);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [playerBusy, setPlayerBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [progress, setProgress] = useState<LongMediaWriteProgress | null>(null);
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [integrityBusy, setIntegrityBusy] = useState(false);
  const [integrityOk, setIntegrityOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([getLongMediaManifest(material.id), getLongMediaTranscript(material.id)])
      .then(([nextManifest, nextTranscript]) => {
        if (cancelled) return;
        setManifest(nextManifest);
        setTranscript(
          nextManifest && nextTranscript?.sourceUploadId === nextManifest.uploadId
            ? nextTranscript
            : undefined,
        );
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : String(error)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [material.id]);

  useEffect(
    () => () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      abortRef.current?.abort();
    },
    [mediaUrl],
  );

  const approvedCount = useMemo(
    () => transcript?.segments.filter((segment) => segment.status === "approved").length ?? 0,
    [transcript],
  );
  const nonEmptyCount = useMemo(
    () => transcript?.segments.filter((segment) => segment.text.trim()).length ?? 0,
    [transcript],
  );

  const loadPlayer = async () => {
    setPlayerBusy(true);
    try {
      const blob = await getLongMediaBlob(material.id);
      if (!blob)
        throw new Error(
          isRu ? "Локальный медиафайл не найден." : "Local media file was not found.",
        );
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      setMediaUrl(URL.createObjectURL(blob));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setPlayerBusy(false);
    }
  };

  const onLoadedMetadata = async (event: React.SyntheticEvent<HTMLMediaElement>) => {
    const duration = event.currentTarget.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !manifest) return;
    if (!manifest.durationSeconds || Math.abs(manifest.durationSeconds - duration) > 1) {
      const updated = await updateLongMediaDuration(material.id, duration);
      if (updated) setManifest(updated);
    }
  };

  const replaceFile = async (file: File | undefined) => {
    if (!file) return;
    const validation = validateLongMediaFile(file);
    if (!validation.ok) {
      toast.error(isRu ? "Нужен аудио- или видеофайл до 4 ГБ." : validation.message);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setReplacing(true);
    setProgress(null);
    try {
      const next = await putLongMediaFile(material.id, file, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      setManifest(next);
      setTranscript(undefined);
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      setMediaUrl(null);
      setIntegrityOk(null);
      store.updateMaterial(material.id, {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        tags: Array.from(new Set([...material.tags, "long-media"])),
        rawText: "",
        processingStatus: "no_text",
        processingMessage: isRu
          ? "Лекция сохранена локально; расшифровка ещё не применена."
          : "Lecture stored locally; no transcript has been applied yet.",
        wordCount: 0,
        charCount: 0,
      });
      toast.success(isRu ? "Новая запись лекции сохранена" : "New lecture recording saved");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        toast.info(
          isRu
            ? "Загрузка отменена; старая копия сохранена."
            : "Upload cancelled; the previous copy is intact.",
        );
      } else {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      abortRef.current = null;
      setReplacing(false);
      setProgress(null);
    }
  };

  const createTranscriptDraft = async () => {
    if (!manifest?.durationSeconds) {
      toast.error(
        isRu
          ? "Сначала загрузи локальный плеер, чтобы определить длительность."
          : "Load the local player first so the duration can be detected.",
      );
      return;
    }
    const now = Date.now();
    const next: LongMediaTranscriptDraft = {
      materialId: material.id,
      sourceUploadId: manifest.uploadId,
      segments: buildTranscriptSegments(manifest.durationSeconds),
      createdAt: now,
      updatedAt: now,
    };
    const saved = await putLongMediaTranscript(next);
    setTranscript(saved);
  };

  const importTranscript = async (file: File | undefined) => {
    if (!file || !manifest) return;
    const content = await file.text();
    let segments = parseTimedTranscript(content);
    if (segments.length === 0 && content.trim()) {
      segments = [
        {
          id: "seg_imported_text",
          startSeconds: 0,
          endSeconds: manifest.durationSeconds ?? 10 * 60,
          text: content.trim(),
          status: "draft",
        },
      ];
    }
    if (segments.length === 0) {
      toast.error(
        isRu
          ? "В файле не найден текст или таймкоды."
          : "No transcript text or timestamps were found.",
      );
      return;
    }
    const now = Date.now();
    const saved = await putLongMediaTranscript({
      materialId: material.id,
      sourceUploadId: manifest.uploadId,
      segments,
      createdAt: transcript?.createdAt ?? now,
      updatedAt: now,
    });
    setTranscript(saved);
    toast.success(
      isRu
        ? `Импортировано блоков: ${segments.length}`
        : `${segments.length} transcript blocks imported`,
    );
  };

  const patchSegment = (id: string, patch: Partial<TranscriptSegmentDraft>) => {
    setTranscript((current) =>
      current
        ? {
            ...current,
            segments: current.segments.map((segment) =>
              segment.id === id ? { ...segment, ...patch } : segment,
            ),
          }
        : current,
    );
  };

  const saveTranscript = async () => {
    if (!transcript) return;
    setSavingTranscript(true);
    try {
      const saved = await putLongMediaTranscript(transcript);
      setTranscript(saved);
      toast.success(isRu ? "Черновик расшифровки сохранён" : "Transcript draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingTranscript(false);
    }
  };

  const applyApprovedTranscript = async () => {
    if (!transcript) return;
    const chunks = transcriptToMaterialChunks(transcript.segments);
    if (chunks.length === 0) {
      toast.error(
        isRu
          ? "Подтверди хотя бы один непустой блок расшифровки."
          : "Approve at least one non-empty transcript block.",
      );
      return;
    }
    setSavingTranscript(true);
    try {
      const saved = await putLongMediaTranscript(transcript);
      setTranscript(saved);
      store.replaceMaterialChunksForMaterial(material.id, chunks);
      const rawText = chunks.map((chunk) => `${chunk.title}\n${chunk.text}`).join("\n\n");
      store.updateMaterial(material.id, {
        rawText,
        processingStatus: "ready",
        processingMessage: isRu
          ? `Применено подтверждённых фрагментов: ${chunks.length}`
          : `${chunks.length} approved transcript blocks applied`,
        charCount: rawText.length,
        wordCount: rawText.trim() ? rawText.trim().split(/\s+/).length : 0,
        extractionMethod: "manual",
      });
      toast.success(
        isRu
          ? `Расшифровка применена: ${chunks.length} source chunks`
          : `Transcript applied as ${chunks.length} source chunks`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingTranscript(false);
    }
  };

  const verifyIntegrity = async () => {
    setIntegrityBusy(true);
    try {
      const ok = await verifyLongMediaIntegrity(material.id);
      setIntegrityOk(ok);
      if (ok)
        toast.success(isRu ? "Все локальные блоки целы" : "All local media chunks are intact");
      else toast.error(isRu ? "Проверка целостности не пройдена" : "Media integrity check failed");
    } catch (error) {
      setIntegrityOk(false);
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIntegrityBusy(false);
    }
  };

  const seekTo = (seconds: number) => {
    if (!mediaRef.current) {
      toast.info(isRu ? "Сначала загрузи локальный плеер." : "Load the local player first.");
      return;
    }
    mediaRef.current.currentTime = seconds;
    void mediaRef.current.play().catch(() => undefined);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-sm">
        <AlertTriangle className="mb-2 h-5 w-5 text-red-300" />
        {isRu
          ? "Метаданные материала есть, но локальный аудио/видеофайл не найден. Загрузите запись заново."
          : "The material exists, but its local audio/video file is missing. Upload the recording again."}
        <div className="mt-4">
          <Button onClick={() => replaceInputRef.current?.click()}>
            <Upload className="me-1 h-4 w-4" />
            {isRu ? "Загрузить запись" : "Upload recording"}
          </Button>
        </div>
        <input
          ref={replaceInputRef}
          hidden
          type="file"
          accept="audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.mp4,.m4v,.mov,.webm,.mkv"
          onChange={(event) => {
            void replaceFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  const MediaIcon = manifest.kind === "video" ? FileVideo2 : FileAudio2;
  const progressPercent = progress
    ? Math.min(100, Math.round((progress.writtenBytes / Math.max(1, progress.totalBytes)) * 100))
    : 0;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary">
              <MediaIcon className="h-4 w-4" />
              {isRu ? "Длинная запись лекции" : "Long lecture recording"}
            </div>
            <h2 className="mt-2 break-words font-serif text-2xl font-semibold">
              {manifest.fileName}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{formatFileSize(manifest.size)}</span>
              <span>{manifest.chunkCount} × 8 MB chunks</span>
              {manifest.durationSeconds ? (
                <span>{formatMediaTime(manifest.durationSeconds)}</span>
              ) : null}
              <span>{manifest.mimeType}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void verifyIntegrity()}
              disabled={integrityBusy}
            >
              {integrityBusy ? (
                <Loader2 className="me-1 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="me-1 h-4 w-4" />
              )}
              {isRu ? "Проверить блоки" : "Verify chunks"}
            </Button>
            <Button
              variant="outline"
              onClick={() => replaceInputRef.current?.click()}
              disabled={replacing}
            >
              <RefreshCw className="me-1 h-4 w-4" />
              {isRu ? "Заменить файл" : "Replace file"}
            </Button>
            {replacing ? (
              <Button variant="destructive" onClick={() => abortRef.current?.abort()}>
                {isRu ? "Отменить" : "Cancel"}
              </Button>
            ) : null}
          </div>
        </div>
        {integrityOk !== null ? (
          <div className={`mt-3 text-xs ${integrityOk ? "text-emerald-300" : "text-red-300"}`}>
            {integrityOk
              ? isRu
                ? "SHA-256 каждого локального блока совпадает."
                : "Every local chunk matches its SHA-256 digest."
              : isRu
                ? "Один или несколько блоков повреждены или отсутствуют."
                : "One or more chunks are damaged or missing."}
          </div>
        ) : null}
        {progress ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>
                {isRu ? "Локальная запись" : "Local write"}: {progress.completedChunks}/
                {progress.totalChunks}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}
        <input
          ref={replaceInputRef}
          hidden
          type="file"
          accept="audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.mp4,.m4v,.mov,.webm,.mkv"
          onChange={(event) => {
            void replaceFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl font-semibold">
              {isRu ? "Локальный плеер" : "Local player"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isRu
                ? "Файл не отправляется в облако. После перезагрузки плеер собирается из локальных 8‑МБ блоков; для очень большого видео это требует дополнительной памяти."
                : "The file is not sent to the cloud. After reload the player is rebuilt from local 8 MB chunks; very large video needs extra memory."}
            </p>
          </div>
          {!mediaUrl ? (
            <Button onClick={() => void loadPlayer()} disabled={playerBusy}>
              {playerBusy ? (
                <Loader2 className="me-1 h-4 w-4 animate-spin" />
              ) : (
                <Play className="me-1 h-4 w-4" />
              )}
              {isRu ? "Загрузить плеер" : "Load player"}
            </Button>
          ) : null}
        </div>
        {mediaUrl ? (
          manifest.kind === "video" ? (
            <video
              ref={(node) => {
                mediaRef.current = node;
              }}
              className="mt-4 max-h-[70vh] w-full rounded-lg bg-black"
              src={mediaUrl}
              controls
              preload="metadata"
              onLoadedMetadata={(event) => void onLoadedMetadata(event)}
            />
          ) : (
            <audio
              ref={(node) => {
                mediaRef.current = node;
              }}
              className="mt-4 w-full"
              src={mediaUrl}
              controls
              preload="metadata"
              onLoadedMetadata={(event) => void onLoadedMetadata(event)}
            />
          )
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary">
              <Clock3 className="h-4 w-4" />
              {isRu ? "Расшифровка по таймкодам" : "Timestamped transcript"}
            </div>
            <h3 className="mt-2 font-serif text-xl font-semibold">
              {isRu ? "Сначала черновик, затем source chunks" : "Draft first, source chunks second"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {isRu
                ? "Можно разбить всю пару на 10‑минутные блоки, вставить текст вручную или импортировать SRT/VTT/TXT. В учебные источники попадут только явно подтверждённые блоки. Автоматической отправки записи внешнему ИИ нет."
                : "Split the full lecture into ten-minute blocks, edit manually, or import SRT/VTT/TXT. Only explicitly approved blocks become study sources. The recording is never sent to external AI automatically."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => transcriptInputRef.current?.click()}>
              <Upload className="me-1 h-4 w-4" />
              {isRu ? "Импорт SRT/VTT/TXT" : "Import SRT/VTT/TXT"}
            </Button>
            {!transcript ? (
              <Button onClick={() => void createTranscriptDraft()}>
                {isRu ? "Создать блоки по 10 минут" : "Create 10-minute blocks"}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => void saveTranscript()}
                  disabled={savingTranscript}
                >
                  {savingTranscript ? (
                    <Loader2 className="me-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="me-1 h-4 w-4" />
                  )}
                  {isRu ? "Сохранить черновик" : "Save draft"}
                </Button>
                <Button
                  onClick={() => void applyApprovedTranscript()}
                  disabled={savingTranscript || approvedCount === 0}
                >
                  <Check className="me-1 h-4 w-4" />
                  {isRu ? `Применить (${approvedCount})` : `Apply (${approvedCount})`}
                </Button>
              </>
            )}
          </div>
        </div>
        <input
          ref={transcriptInputRef}
          hidden
          type="file"
          accept=".srt,.vtt,.txt,text/plain,text/vtt,application/x-subrip"
          onChange={(event) => {
            void importTranscript(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {transcript ? (
          <>
            <div className="mt-4 flex flex-wrap gap-3 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
              <span>
                {isRu ? "Всего блоков" : "Blocks"}: {transcript.segments.length}
              </span>
              <span>
                {isRu ? "С текстом" : "With text"}: {nonEmptyCount}
              </span>
              <span>
                {isRu ? "Подтверждено" : "Approved"}: {approvedCount}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setTranscript((current) =>
                    current
                      ? {
                          ...current,
                          segments: current.segments.map((segment) => ({
                            ...segment,
                            status: segment.text.trim() ? "approved" : "empty",
                          })),
                        }
                      : current,
                  )
                }
              >
                {isRu ? "Подтвердить все непустые" : "Approve all non-empty"}
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {transcript.segments.map((segment, index) => (
                <article
                  key={segment.id}
                  className="rounded-lg border border-border bg-background p-3 md:p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => seekTo(segment.startSeconds)}
                      >
                        <Play className="me-1 h-3.5 w-3.5" />
                        {formatMediaTime(segment.startSeconds)}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        → {formatMediaTime(segment.endSeconds)} · #{index + 1}
                      </span>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={segment.status === "approved"}
                        disabled={!segment.text.trim()}
                        onChange={(event) =>
                          patchSegment(segment.id, {
                            status: event.target.checked
                              ? "approved"
                              : segment.text.trim()
                                ? "draft"
                                : "empty",
                          })
                        }
                      />
                      {isRu ? "Подтверждено как источник" : "Approved as source"}
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {isRu ? "Спикер" : "Speaker"}
                      </label>
                      <Input
                        className="mt-1"
                        value={segment.speaker ?? ""}
                        onChange={(event) =>
                          patchSegment(segment.id, { speaker: event.target.value })
                        }
                        placeholder={isRu ? "Лектор / студент" : "Lecturer / student"}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {isRu ? "Текст блока" : "Block text"}
                      </label>
                      <Textarea
                        className="mt-1 min-h-28"
                        value={segment.text}
                        onChange={(event) =>
                          patchSegment(segment.id, {
                            text: event.target.value,
                            status:
                              segment.status === "approved"
                                ? "approved"
                                : event.target.value.trim()
                                  ? "draft"
                                  : "empty",
                          })
                        }
                        dir="auto"
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <HardDrive className="mx-auto mb-2 h-6 w-6" />
            {isRu
              ? "Запись уже хранится локально. Загрузите плеер для определения длительности, затем создайте таймкодные блоки или импортируйте готовую расшифровку."
              : "The recording is already stored locally. Load the player to detect duration, then create timestamp blocks or import a transcript."}
          </div>
        )}
      </section>
    </div>
  );
}
