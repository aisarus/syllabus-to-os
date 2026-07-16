import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CloudUpload,
  FileAudio2,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import {
  beginAutomaticTranscriptionJob,
  buildTranscriptDraftFromAutomaticJob,
  findAutomaticTranscriptionGaps,
  getAutomaticTranscriptionProviderStatus,
  normalizeAutomaticSegments,
  requestAutomaticTranscription,
  validateAutomaticTranscriptionFile,
  type AutomaticTranscriptionJob,
  type AutomaticTranscriptionProviderStatus,
} from "@/lib/automatic-transcription";
import {
  deleteAutomaticTranscriptionJob,
  getAutomaticTranscriptionJob,
  putAutomaticTranscriptionJob,
} from "@/lib/automatic-transcription-store";
import { formatFileSize } from "@/lib/document-ingestion";
import { formatMediaTime, type LongMediaManifest } from "@/lib/long-media";
import {
  getLongMediaBlob,
  getLongMediaManifest,
  getLongMediaTranscript,
  putLongMediaTranscript,
} from "@/lib/long-media-store";
import type { Material } from "@/lib/store";

interface ProviderModels {
  plainModel?: string;
  speakerModel?: string;
}

export function AutomaticTranscriptionPanel({
  material,
  onDraftApplied,
}: {
  material: Material;
  onDraftApplied?: () => void;
}) {
  const { lang } = useApp();
  const isRu = lang === "ru";
  const copyInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [manifest, setManifest] = useState<LongMediaManifest | undefined>();
  const [providerStatus, setProviderStatus] = useState<AutomaticTranscriptionProviderStatus>();
  const [job, setJob] = useState<AutomaticTranscriptionJob | undefined>();
  const [providerCopy, setProviderCopy] = useState<File | null>(null);
  const [language, setLanguage] = useState("auto");
  const [requestSpeakerLabels, setRequestSpeakerLabels] = useState(true);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      getLongMediaManifest(material.id),
      getAutomaticTranscriptionProviderStatus(),
      getAutomaticTranscriptionJob(material.id),
    ])
      .then(async ([nextManifest, nextStatus, nextJob]) => {
        if (cancelled) return;
        setManifest(nextManifest);
        setProviderStatus(nextStatus);
        if (nextJob && nextManifest && nextJob.sourceUploadId !== nextManifest.uploadId) {
          await deleteAutomaticTranscriptionJob(material.id).catch(() => undefined);
          setJob(undefined);
          return;
        }
        if (nextJob && (nextJob.status === "uploading" || nextJob.status === "processing")) {
          const interrupted = await putAutomaticTranscriptionJob({
            ...nextJob,
            status: "failed",
            error: isRu
              ? "Предыдущий запрос прервался вместе с вкладкой. Файл не стал источником; можно повторить."
              : "The previous request ended with the browser session. Nothing became a source; retry is safe.",
          });
          setJob(interrupted);
        } else {
          setJob(nextJob);
        }
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : String(error)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [isRu, material.id]);

  const selectedFile = providerCopy
    ? { name: providerCopy.name, size: providerCopy.size, type: providerCopy.type }
    : manifest
      ? { name: manifest.fileName, size: manifest.size, type: manifest.mimeType }
      : undefined;
  const originalValidation = manifest
    ? validateAutomaticTranscriptionFile(
        { name: manifest.fileName, size: manifest.size },
        providerStatus?.maxBytes,
      )
    : undefined;
  const canUseOriginal = originalValidation?.ok === true;
  const copyValidation = providerCopy
    ? validateAutomaticTranscriptionFile(providerCopy, providerStatus?.maxBytes)
    : undefined;
  const selectedValidation = providerCopy ? copyValidation : originalValidation;
  const resultSegments = useMemo(
    () => normalizeAutomaticSegments(job?.resultSegments ?? [], manifest?.durationSeconds),
    [job?.resultSegments, manifest?.durationSeconds],
  );
  const gaps = useMemo(
    () => findAutomaticTranscriptionGaps(resultSegments, manifest?.durationSeconds),
    [resultSegments, manifest?.durationSeconds],
  );
  const uncertainCount = resultSegments.filter((segment) => segment.uncertain).length;
  const models = providerStatus as
    | (AutomaticTranscriptionProviderStatus & ProviderModels)
    | undefined;
  const selectedModel = requestSpeakerLabels
    ? (models?.speakerModel ?? providerStatus?.model)
    : (models?.plainModel ?? providerStatus?.model);

  const chooseProviderCopy = (file: File | undefined) => {
    if (!file) return;
    const validation = validateAutomaticTranscriptionFile(file, providerStatus?.maxBytes);
    if (!validation.ok) {
      toast.error(isRu ? providerFileError(validation.reason) : validation.message);
      return;
    }
    setProviderCopy(file);
    setConsent(false);
  };

  const resolveProviderFile = async (): Promise<{ file: File; usedProviderCopy: boolean }> => {
    if (providerCopy) return { file: providerCopy, usedProviderCopy: true };
    if (!manifest || !canUseOriginal) {
      throw new Error(
        isRu
          ? "Выбери отдельную сжатую копию для провайдера. Оригинал останется локальным."
          : "Choose a compressed provider copy. The original remains local.",
      );
    }
    const blob = await getLongMediaBlob(material.id);
    if (!blob)
      throw new Error(isRu ? "Локальная запись не найдена." : "Local recording not found.");
    return {
      file: new File([blob], manifest.fileName, { type: manifest.mimeType }),
      usedProviderCopy: false,
    };
  };

  const start = async () => {
    if (!manifest || !providerStatus?.configured || !consent) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setUploadProgress(0);
    try {
      const resolved = await resolveProviderFile();
      const validation = validateAutomaticTranscriptionFile(resolved.file, providerStatus.maxBytes);
      if (!validation.ok) throw new Error(validation.message);
      const initial = beginAutomaticTranscriptionJob({
        manifest,
        providerStatus: {
          ...providerStatus,
          model: selectedModel ?? providerStatus.model,
        },
        file: resolved.file,
        usedProviderCopy: resolved.usedProviderCopy,
        language: language === "auto" ? undefined : language,
        requestSpeakerLabels,
        previous: job,
      });
      const savedInitial = await putAutomaticTranscriptionJob(initial);
      setJob(savedInitial);

      const response = await requestAutomaticTranscription({
        file: resolved.file,
        materialId: material.id,
        sourceUploadId: manifest.uploadId,
        durationSeconds: manifest.durationSeconds,
        language: language === "auto" ? undefined : language,
        requestSpeakerLabels,
        signal: controller.signal,
        onUploadProgress: (fraction) => {
          setUploadProgress(fraction);
          setJob((current) =>
            current
              ? {
                  ...current,
                  status: fraction >= 1 ? "processing" : "uploading",
                  uploadProgress: fraction,
                }
              : current,
          );
        },
      });

      if (controller.signal.aborted) {
        const cancelled = await putAutomaticTranscriptionJob({
          ...savedInitial,
          status: "cancelled",
          uploadProgress,
          error: isRu ? "Запрос отменён пользователем." : "Request cancelled by the user.",
        });
        setJob(cancelled);
        return;
      }
      const currentManifest = await getLongMediaManifest(material.id);
      if (!currentManifest || currentManifest.uploadId !== manifest.uploadId) {
        throw new Error(
          isRu
            ? "Пока провайдер работал, запись лекции была заменена. Результат сохранён не будет."
            : "The lecture recording changed while the provider was working. The result will not be saved.",
        );
      }
      if (!response.ok || !response.segments?.length) {
        const failed = await putAutomaticTranscriptionJob({
          ...savedInitial,
          status: "failed",
          uploadProgress: 1,
          model: response.model ?? savedInitial.model,
          providerRequestId: response.requestId,
          warnings: response.warnings ?? [],
          error: response.error || "Transcription provider returned no usable segments.",
        });
        setJob(failed);
        toast.error(failed.error);
        return;
      }
      const ready = await putAutomaticTranscriptionJob({
        ...savedInitial,
        status: "review_ready",
        uploadProgress: 1,
        model: response.model ?? savedInitial.model,
        providerDisplayName: response.providerDisplayName ?? savedInitial.providerDisplayName,
        providerRequestId: response.requestId,
        language: response.language ?? savedInitial.language,
        resultSegments: normalizeAutomaticSegments(response.segments, manifest.durationSeconds),
        warnings: response.warnings ?? [],
        error: undefined,
      });
      setJob(ready);
      toast.success(
        isRu
          ? `Получено черновых фрагментов: ${ready.resultSegments.length}`
          : `${ready.resultSegments.length} draft transcript segments received`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (controller.signal.aborted) {
        toast.info(isRu ? "Авторасшифровка отменена" : "Automatic transcription cancelled");
      } else {
        const base =
          job ??
          (manifest && providerStatus && selectedFile
            ? beginAutomaticTranscriptionJob({
                manifest,
                providerStatus,
                file: selectedFile,
                usedProviderCopy: Boolean(providerCopy),
                language: language === "auto" ? undefined : language,
                requestSpeakerLabels,
              })
            : undefined);
        if (base) {
          const failed = await putAutomaticTranscriptionJob({
            ...base,
            status: "failed",
            error: message,
          });
          setJob(failed);
        }
        toast.error(message);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const cancel = async () => {
    abortRef.current?.abort();
    if (!job) return;
    const cancelled = await putAutomaticTranscriptionJob({
      ...job,
      status: "cancelled",
      error: isRu ? "Запрос отменён пользователем." : "Request cancelled by the user.",
    });
    setJob(cancelled);
    setBusy(false);
  };

  const loadCandidateIntoEditor = async () => {
    if (!job || !manifest) return;
    const existing = await getLongMediaTranscript(material.id);
    const hasApprovedDraft = existing?.segments.some((segment) => segment.status === "approved");
    if (
      hasApprovedDraft &&
      !window.confirm(
        isRu
          ? "В редакторе есть подтверждённые блоки. Новый provider-result заменит редактируемый черновик, но уже применённые source chunks останутся без изменений до следующего нажатия «Применить». Продолжить?"
          : "The editor has approved blocks. The provider result will replace the editable draft, while already applied source chunks stay unchanged until Apply is pressed again. Continue?",
      )
    ) {
      return;
    }
    try {
      const draft = buildTranscriptDraftFromAutomaticJob(job, manifest, existing);
      await putLongMediaTranscript(draft);
      const loaded = await putAutomaticTranscriptionJob({ ...job, status: "draft_loaded" });
      setJob(loaded);
      onDraftApplied?.();
      toast.success(
        isRu
          ? "Provider-result перенесён в редактор как неподтверждённый черновик"
          : "Provider result loaded into the editor as an unapproved draft",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const discard = async () => {
    await deleteAutomaticTranscriptionJob(material.id);
    setJob(undefined);
    setConsent(false);
    setUploadProgress(0);
  };

  if (loading) {
    return (
      <section className="mb-5 rounded-xl border border-border bg-surface p-5 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </section>
    );
  }

  return (
    <section className="mb-5 rounded-xl border border-primary/25 bg-primary/5 p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary">
            <Bot className="h-4 w-4" />
            {isRu ? "Проверяемая авторасшифровка" : "Reviewed automatic transcription"}
          </div>
          <h2 className="mt-2 font-serif text-xl font-semibold">
            {isRu
              ? "Сначала согласие и provider-result, потом редактор"
              : "Consent and provider result first, editor second"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isRu
              ? "Открытие материала, локальный плеер и SHA-проверка ничего не загружают. Только кнопка ниже после твоего согласия отправляет выбранную provider-копию. Полученный текст остаётся отдельным локальным candidate и не становится source chunk автоматически."
              : "Opening the material, loading the local player and SHA verification upload nothing. Only the button below, after consent, sends the selected provider copy. Returned text remains a separate local candidate and never becomes a source chunk automatically."}
          </p>
        </div>
        {job ? (
          <Button variant="ghost" size="sm" onClick={() => void discard()} disabled={busy}>
            <Trash2 className="me-1 h-4 w-4" />
            {isRu ? "Удалить candidate" : "Delete candidate"}
          </Button>
        ) : null}
      </div>

      {!providerStatus?.configured ? (
        <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm">
          <ShieldAlert className="mb-2 h-5 w-5 text-yellow-300" />
          <strong>{isRu ? "Провайдер не подключён" : "Provider is not configured"}</strong>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isRu
              ? "Для реальной отправки deployment должен иметь серверный OPENAI_API_KEY. Ключ не хранится в браузере. Ручной импорт SRT/VTT/TXT продолжает работать без провайдера."
              : "The deployment needs a server-side OPENAI_API_KEY for real uploads. The key is never stored in the browser. Manual SRT/VTT/TXT import still works without a provider."}
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              {isRu ? "Язык записи" : "Recording language"}
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                disabled={busy}
              >
                <option value="auto">
                  {isRu ? "Определить автоматически" : "Detect automatically"}
                </option>
                <option value="he">עברית</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={requestSpeakerLabels}
                onChange={(event) => setRequestSpeakerLabels(event.target.checked)}
                disabled={busy}
              />
              <span>
                <strong className="block">
                  {isRu ? "Попросить разделение по говорящим" : "Request speaker labels"}
                </strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {isRu
                    ? "Провайдер может вернуть Speaker A/B; все подписи всё равно требуют проверки."
                    : "The provider may return Speaker A/B; every label still needs review."}
                </span>
              </span>
            </label>
          </div>

          <div className="mt-4 rounded-md border border-border p-3 text-sm">
            <div className="flex items-start gap-3">
              <FileAudio2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <strong className="block break-words">{selectedFile?.name ?? "—"}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {selectedFile ? formatFileSize(selectedFile.size) : "—"} ·{" "}
                  {selectedFile?.type || "unknown MIME"}
                </span>
                {providerCopy ? (
                  <span className="mt-1 block text-xs text-yellow-200">
                    {isRu
                      ? "Будет отправлена отдельная provider-копия; локальный оригинал не загружается."
                      : "A separate provider copy will be sent; the local original is not uploaded."}
                  </span>
                ) : null}
                {!canUseOriginal && !providerCopy ? (
                  <span className="mt-2 block text-xs text-yellow-200">
                    {isRu
                      ? "Оригинал слишком большой или неподдерживаемого формата. Выбери сжатую копию всей лекции до лимита провайдера без изменения скорости."
                      : "The original is too large or unsupported. Choose a compressed full-lecture copy within the provider limit without changing playback speed."}
                  </span>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyInputRef.current?.click()}
                disabled={busy}
              >
                <CloudUpload className="me-1 h-4 w-4" />
                {isRu ? "Другая копия" : "Different copy"}
              </Button>
            </div>
            <input
              ref={copyInputRef}
              hidden
              type="file"
              accept=".flac,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm,audio/*,video/mp4,video/webm"
              onChange={(event) => {
                chooseProviderCopy(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {providerCopy ? (
              <Button
                className="mt-2"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProviderCopy(null);
                  setConsent(false);
                }}
                disabled={busy}
              >
                <X className="me-1 h-4 w-4" />
                {isRu ? "Вернуться к оригиналу" : "Use original instead"}
              </Button>
            ) : null}
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-md border border-red-500/25 bg-red-500/5 p-3 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={busy || !providerStatus?.configured || selectedValidation?.ok !== true}
            />
            <span>
              <strong className="block">
                {isRu ? "Я явно разрешаю эту отправку" : "I explicitly authorize this upload"}
              </strong>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {isRu
                  ? `Получатель: ${providerStatus?.displayName ?? "—"}. Модель: ${selectedModel ?? "—"}. Файл: ${selectedFile?.name ?? "—"}, ${selectedFile ? formatFileSize(selectedFile.size) : "—"}.`
                  : `Recipient: ${providerStatus?.displayName ?? "—"}. Model: ${selectedModel ?? "—"}. File: ${selectedFile?.name ?? "—"}, ${selectedFile ? formatFileSize(selectedFile.size) : "—"}.`}
              </span>
              <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                {providerStatus?.disclosure}
              </span>
            </span>
          </label>

          {busy || job?.status === "uploading" || job?.status === "processing" ? (
            <div className="mt-4 rounded-md border border-border p-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {uploadProgress >= 1
                    ? isRu
                      ? "Провайдер обрабатывает запись"
                      : "Provider is processing the recording"
                    : isRu
                      ? "Отправка provider-копии"
                      : "Uploading provider copy"}
                </span>
                <span>{Math.round(uploadProgress * 100)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${uploadProgress * 100}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => void start()}
              disabled={
                busy ||
                !providerStatus?.configured ||
                !consent ||
                !manifest ||
                selectedValidation?.ok !== true
              }
            >
              {busy ? (
                <Loader2 className="me-1 h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="me-1 h-4 w-4" />
              )}
              {job?.status === "failed" || job?.status === "cancelled"
                ? isRu
                  ? "Повторить запрос"
                  : "Retry request"
                : isRu
                  ? "Отправить на расшифровку"
                  : "Send for transcription"}
            </Button>
            {busy ? (
              <Button variant="destructive" onClick={() => void cancel()}>
                <X className="me-1 h-4 w-4" />
                {isRu ? "Отменить" : "Cancel"}
              </Button>
            ) : null}
            {job?.status === "failed" || job?.status === "cancelled" ? (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <RotateCcw className="me-1 h-3.5 w-3.5" />
                {isRu ? `Попыток: ${job.attempt}` : `Attempts: ${job.attempt}`}
              </span>
            ) : null}
          </div>
          {job?.error ? <p className="mt-3 text-xs text-red-300">{job.error}</p> : null}
        </div>

        <aside className="rounded-lg border border-border bg-background p-4">
          <strong>{isRu ? "Локальный candidate" : "Local candidate"}</strong>
          {!job || resultSegments.length === 0 ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {isRu
                ? "Provider-result появится здесь и сохранится локально. Ошибка или отмена не изменят текущую расшифровку и source chunks."
                : "The provider result appears here and is saved locally. Failure or cancellation does not change the current transcript or source chunks."}
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <Metric label={isRu ? "Блоки" : "Blocks"} value={resultSegments.length} />
                <Metric label={isRu ? "Сомн." : "Uncertain"} value={uncertainCount} />
                <Metric label={isRu ? "Пробелы" : "Gaps"} value={gaps.length} />
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-auto pe-1">
                {resultSegments.slice(0, 12).map((segment) => (
                  <div
                    key={segment.id}
                    className={`rounded-md border p-2 text-xs ${segment.uncertain ? "border-yellow-500/30 bg-yellow-500/5" : "border-border"}`}
                  >
                    <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {formatMediaTime(segment.startSeconds)}–
                        {formatMediaTime(segment.endSeconds)}
                      </span>
                      <span>
                        {segment.speaker || (isRu ? "говорящий не указан" : "speaker unknown")}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap">{segment.text}</p>
                    {segment.issues?.length ? (
                      <p className="mt-1 text-[11px] text-yellow-200">{segment.issues.join(" ")}</p>
                    ) : null}
                  </div>
                ))}
              </div>
              {gaps.length > 0 ? (
                <div className="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2 text-[11px] text-yellow-100">
                  <AlertTriangle className="me-1 inline h-3.5 w-3.5" />
                  {isRu ? "Непокрытые интервалы: " : "Uncovered intervals: "}
                  {gaps
                    .slice(0, 5)
                    .map(
                      (gap) =>
                        `${formatMediaTime(gap.startSeconds)}–${formatMediaTime(gap.endSeconds)}`,
                    )
                    .join(", ")}
                </div>
              ) : null}
              {job.warnings.map((warning) => (
                <p key={warning} className="mt-2 text-[11px] text-yellow-200">
                  {warning}
                </p>
              ))}
              <Button
                className="mt-4 w-full"
                onClick={() => void loadCandidateIntoEditor()}
                disabled={job.status !== "review_ready" && job.status !== "draft_loaded"}
              >
                <CheckCircle2 className="me-1 h-4 w-4" />
                {job.status === "draft_loaded"
                  ? isRu
                    ? "Заново открыть в редакторе"
                    : "Reload into editor"
                  : isRu
                    ? "Перенести в редактор как draft"
                    : "Load into editor as draft"}
              </Button>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                {isRu
                  ? "Даже после этой кнопки все блоки останутся неподтверждёнными. Source chunks появятся только после ручной проверки статусов и отдельного «Применить»."
                  : "Even after this button every block remains unapproved. Source chunks appear only after manual status review and a separate Apply action."}
              </p>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border p-2">
      <strong className="block text-base">{value}</strong>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function providerFileError(reason: "empty" | "too_large" | "unsupported"): string {
  if (reason === "empty") return "Файл для провайдера пуст.";
  if (reason === "too_large") return "Provider-копия превышает лимит 24 МБ.";
  return "Нужна provider-копия FLAC/MP3/MP4/MPEG/MPGA/M4A/OGG/WAV/WebM.";
}
