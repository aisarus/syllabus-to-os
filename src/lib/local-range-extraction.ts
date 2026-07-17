import type { LongMediaManifest } from "./long-media";
import { getLongMediaBlob, getLongMediaManifest } from "./long-media-store";
import type { ResumableTranscriptionRange } from "./resumable-transcription";

export const DEFAULT_LOCAL_EXTRACTION_BITRATE = 96_000;
export const LOCAL_EXTRACTION_DURATION_TOLERANCE_SECONDS = 2.5;

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

export type LocalRangeExtractionReasonCode =
  | "browser_only"
  | "media_recorder_unavailable"
  | "web_audio_unavailable"
  | "opus_unavailable";

export interface LocalRangeExtractionCapability {
  supported: boolean;
  mimeType?: string;
  reason?: string;
  reasonCode?: LocalRangeExtractionReasonCode;
}

export interface LocalRangeExtractionEstimate {
  durationSeconds: number;
  processingSeconds: number;
  expectedOutputBytes: number;
  temporaryStorageBytes: number;
  workingMemoryBytes: number;
  audioBitsPerSecond: number;
}

export interface LocalRangeExtractionProgress {
  fraction: number;
  currentTimeSeconds: number;
  elapsedSeconds: number;
}

export interface LocalRangeExtractionResult {
  file: File;
  mimeType: string;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
  createdAt: number;
}

interface AudioContextWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export function getLocalRangeExtractionCapability(): LocalRangeExtractionCapability {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      supported: false,
      reason: "Local extraction is available only in a browser.",
      reasonCode: "browser_only",
    };
  }
  if (typeof MediaRecorder === "undefined") {
    return {
      supported: false,
      reason: "This browser does not provide MediaRecorder.",
      reasonCode: "media_recorder_unavailable",
    };
  }
  const AudioContextConstructor =
    window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
  if (!AudioContextConstructor) {
    return {
      supported: false,
      reason: "This browser does not provide Web Audio.",
      reasonCode: "web_audio_unavailable",
    };
  }
  const mimeType = MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!mimeType) {
    return {
      supported: false,
      reason: "No provider-ready Opus audio container is supported.",
      reasonCode: "opus_unavailable",
    };
  }
  return { supported: true, mimeType };
}

export function estimateLocalRangeExtraction(
  manifest: Pick<LongMediaManifest, "chunkSize">,
  range: Pick<ResumableTranscriptionRange, "startSeconds" | "endSeconds">,
  audioBitsPerSecond = DEFAULT_LOCAL_EXTRACTION_BITRATE,
): LocalRangeExtractionEstimate {
  const durationSeconds = Math.max(0, range.endSeconds - range.startSeconds);
  const boundedBitrate = Math.max(32_000, Math.min(192_000, Math.round(audioBitsPerSecond)));
  const encodedBytes = Math.ceil((durationSeconds * boundedBitrate) / 8);
  const expectedOutputBytes = Math.ceil(encodedBytes * 1.12);
  return {
    durationSeconds,
    processingSeconds: durationSeconds,
    expectedOutputBytes,
    temporaryStorageBytes: Math.ceil(expectedOutputBytes * 1.25),
    workingMemoryBytes: Math.ceil(
      Math.min(Math.max(1, manifest.chunkSize) * 3, 32 * 1024 * 1024) +
        expectedOutputBytes +
        4 * 1024 * 1024,
    ),
    audioBitsPerSecond: boundedBitrate,
  };
}

export function validateLocalRangeExtractionRequest(input: {
  manifest: LongMediaManifest;
  range: ResumableTranscriptionRange;
  maxOutputBytes?: number;
  audioBitsPerSecond?: number;
}): LocalRangeExtractionEstimate {
  const { manifest, range } = input;
  if (!manifest.durationSeconds || manifest.durationSeconds <= 0) {
    throw new Error("The lecture duration is required before local range extraction.");
  }
  if (
    !Number.isFinite(range.startSeconds) ||
    !Number.isFinite(range.endSeconds) ||
    range.startSeconds < 0 ||
    range.endSeconds <= range.startSeconds ||
    range.endSeconds > manifest.durationSeconds + 0.01
  ) {
    throw new Error("The requested range is outside the stored lecture duration.");
  }
  const estimate = estimateLocalRangeExtraction(manifest, range, input.audioBitsPerSecond);
  if (input.maxOutputBytes && estimate.expectedOutputBytes > input.maxOutputBytes) {
    throw new Error(
      "This range is expected to exceed the provider file-size boundary. Use a shorter range.",
    );
  }
  return estimate;
}

export function validateExtractedRangeClip(input: {
  expectedDurationSeconds: number;
  capturedDurationSeconds: number;
  size: number;
  mimeType: string;
  maxBytes?: number;
}): void {
  if (!Number.isFinite(input.size) || input.size <= 0) {
    throw new Error("Local extraction produced an empty clip.");
  }
  if (input.maxBytes && input.size > input.maxBytes) {
    throw new Error("The extracted clip is larger than the provider request boundary.");
  }
  if (!input.mimeType.startsWith("audio/")) {
    throw new Error("Local extraction did not produce an audio clip.");
  }
  const tolerance = Math.max(
    LOCAL_EXTRACTION_DURATION_TOLERANCE_SECONDS,
    input.expectedDurationSeconds * 0.01,
  );
  if (
    !Number.isFinite(input.capturedDurationSeconds) ||
    Math.abs(input.capturedDurationSeconds - input.expectedDurationSeconds) > tolerance
  ) {
    throw new Error("The extracted clip duration does not match the requested lecture range.");
  }
}

export async function extractLongMediaRangeLocally(input: {
  manifest: LongMediaManifest;
  range: ResumableTranscriptionRange;
  maxOutputBytes?: number;
  audioBitsPerSecond?: number;
  signal?: AbortSignal;
  onProgress?: (progress: LocalRangeExtractionProgress) => void;
}): Promise<LocalRangeExtractionResult> {
  const capability = getLocalRangeExtractionCapability();
  if (!capability.supported || !capability.mimeType) {
    throw new Error(capability.reason ?? "Local range extraction is unavailable.");
  }
  const estimate = validateLocalRangeExtractionRequest({
    manifest: input.manifest,
    range: input.range,
    maxOutputBytes: input.maxOutputBytes,
    audioBitsPerSecond: input.audioBitsPerSecond,
  });
  throwIfAborted(input.signal);

  const latestBefore = await getLongMediaManifest(input.manifest.materialId);
  if (!latestBefore || latestBefore.uploadId !== input.manifest.uploadId) {
    throw new Error("The lecture recording changed before local extraction started.");
  }
  const sourceBlob = await getLongMediaBlob(input.manifest.materialId);
  if (!sourceBlob) throw new Error("The locally stored lecture could not be reconstructed.");
  throwIfAborted(input.signal);

  const objectUrl = URL.createObjectURL(sourceBlob);
  const media = document.createElement(input.manifest.kind === "video" ? "video" : "audio");
  media.preload = "auto";
  media.src = objectUrl;
  media.playbackRate = 1;
  if (media instanceof HTMLVideoElement) media.playsInline = true;

  const AudioContextConstructor =
    window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
  if (!AudioContextConstructor) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Web Audio is unavailable in this browser.");
  }

  const audioContext = new AudioContextConstructor();
  const destination = audioContext.createMediaStreamDestination();
  const source = audioContext.createMediaElementSource(media);
  source.connect(destination);
  const recorder = new MediaRecorder(destination.stream, {
    mimeType: capability.mimeType,
    audioBitsPerSecond: estimate.audioBitsPerSecond,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  let capturedDurationSeconds = 0;
  try {
    await waitForMediaMetadata(media, input.signal);
    if (!Number.isFinite(media.duration) || media.duration + 0.01 < input.range.endSeconds) {
      throw new Error("The stored media metadata is shorter than the requested range.");
    }
    await audioContext.resume();
    await seekMedia(media, input.range.startSeconds, input.signal);

    const stopped = waitForRecorderStop(recorder);
    recorder.start(1_000);
    await media.play();
    const wallStartedAt = performance.now();
    await monitorRangePlayback({
      media,
      range: input.range,
      signal: input.signal,
      onProgress: input.onProgress,
      wallStartedAt,
    });
    media.pause();
    capturedDurationSeconds = Math.max(0, media.currentTime - input.range.startSeconds);
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
  } catch (error) {
    media.pause();
    if (recorder.state !== "inactive") recorder.stop();
    throw error;
  } finally {
    destination.stream.getTracks().forEach((track) => track.stop());
    source.disconnect();
    await audioContext.close().catch(() => undefined);
    media.removeAttribute("src");
    media.load();
    URL.revokeObjectURL(objectUrl);
  }

  const clipBlob = new Blob(chunks, { type: capability.mimeType });
  const encodedDurationSeconds = await measureEncodedAudioDuration(clipBlob, input.signal);
  validateExtractedRangeClip({
    expectedDurationSeconds: estimate.durationSeconds,
    capturedDurationSeconds: encodedDurationSeconds,
    size: clipBlob.size,
    mimeType: capability.mimeType,
    maxBytes: input.maxOutputBytes,
  });

  const latestAfter = await getLongMediaManifest(input.manifest.materialId);
  if (!latestAfter || latestAfter.uploadId !== input.manifest.uploadId) {
    throw new Error("The lecture recording changed while the clip was being created.");
  }

  const extension = capability.mimeType.includes("ogg") ? "ogg" : "webm";
  const startMs = Math.round(input.range.startSeconds * 1_000);
  const endMs = Math.round(input.range.endSeconds * 1_000);
  const fileName = `lamdan-${input.manifest.uploadId.slice(-8)}-${startMs}-${endMs}.${extension}`;
  const createdAt = Date.now();
  return {
    file: new File([clipBlob], fileName, {
      type: capability.mimeType,
      lastModified: createdAt,
    }),
    mimeType: capability.mimeType,
    durationSeconds: encodedDurationSeconds,
    startSeconds: input.range.startSeconds,
    endSeconds: input.range.endSeconds,
    createdAt,
  };
}

async function measureEncodedAudioDuration(blob: Blob, signal?: AbortSignal): Promise<number> {
  throwIfAborted(signal);
  const objectUrl = URL.createObjectURL(blob);
  const media = document.createElement("audio");
  media.preload = "metadata";
  media.src = objectUrl;
  try {
    await waitForMediaMetadata(media, signal);
    if (Number.isFinite(media.duration) && media.duration > 0) return media.duration;

    const durationChanged = waitForMediaEvent(media, "durationchange", signal, 10_000);
    media.currentTime = Number.MAX_SAFE_INTEGER;
    await durationChanged;
    if (!Number.isFinite(media.duration) || media.duration <= 0) {
      throw new Error("The encoded audio duration could not be measured.");
    }
    return media.duration;
  } finally {
    media.removeAttribute("src");
    media.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function waitForMediaMetadata(media: HTMLMediaElement, signal?: AbortSignal): Promise<void> {
  if (media.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return waitForMediaEvent(media, "loadedmetadata", signal, 30_000);
}

async function seekMedia(
  media: HTMLMediaElement,
  targetSeconds: number,
  signal?: AbortSignal,
): Promise<void> {
  if (Math.abs(media.currentTime - targetSeconds) <= 0.05) return;
  const seeked = waitForMediaEvent(media, "seeked", signal, 30_000);
  media.currentTime = targetSeconds;
  await seeked;
}

function waitForMediaEvent(
  media: HTMLMediaElement,
  eventName: "loadedmetadata" | "seeked" | "durationchange",
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => finish(new Error("Timed out while reading local media.")),
      timeoutMs,
    );
    const onSuccess = () => finish();
    const onError = () =>
      finish(new Error(media.error?.message ?? "The local media could not be decoded."));
    const onAbort = () => finish(new DOMException("Local extraction cancelled.", "AbortError"));
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      media.removeEventListener(eventName, onSuccess);
      media.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    media.addEventListener(eventName, onSuccess, { once: true });
    media.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function waitForRecorderStop(recorder: MediaRecorder): Promise<void> {
  return new Promise((resolve, reject) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
    recorder.addEventListener(
      "error",
      () => reject(new Error("The browser audio encoder failed.")),
      { once: true },
    );
  });
}

function monitorRangePlayback(input: {
  media: HTMLMediaElement;
  range: Pick<ResumableTranscriptionRange, "startSeconds" | "endSeconds">;
  signal?: AbortSignal;
  onProgress?: (progress: LocalRangeExtractionProgress) => void;
  wallStartedAt: number;
}): Promise<void> {
  const duration = Math.max(0.01, input.range.endSeconds - input.range.startSeconds);
  const inactivityLimitMs = 15_000;
  return new Promise((resolve, reject) => {
    let timer = 0;
    let settled = false;
    let lastMediaTime = input.media.currentTime;
    let lastAdvanceAt = performance.now();
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
      input.media.removeEventListener("error", onMediaError);
      input.media.removeEventListener("stalled", onStalled);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(new DOMException("Local extraction cancelled.", "AbortError"));
    const onMediaError = () =>
      finish(new Error(input.media.error?.message ?? "The local media decoder failed."));
    const onStalled = () => finish(new Error("Local media playback stalled during extraction."));
    const tick = () => {
      if (input.signal?.aborted) {
        onAbort();
        return;
      }
      const now = performance.now();
      const currentTime = input.media.currentTime;
      if (currentTime > lastMediaTime + 0.01) {
        lastMediaTime = currentTime;
        lastAdvanceAt = now;
      } else if (!input.media.paused && now - lastAdvanceAt > inactivityLimitMs) {
        finish(new Error("Local media playback stopped advancing during extraction."));
        return;
      }
      const captured = Math.max(0, currentTime - input.range.startSeconds);
      input.onProgress?.({
        fraction: Math.max(0, Math.min(1, captured / duration)),
        currentTimeSeconds: currentTime,
        elapsedSeconds: Math.max(0, (now - input.wallStartedAt) / 1_000),
      });
      if (currentTime >= input.range.endSeconds - 0.05 || input.media.ended) {
        input.onProgress?.({
          fraction: 1,
          currentTimeSeconds: Math.min(currentTime, input.range.endSeconds),
          elapsedSeconds: Math.max(0, (now - input.wallStartedAt) / 1_000),
        });
        finish();
        return;
      }
      timer = window.setTimeout(tick, 125);
    };
    input.signal?.addEventListener("abort", onAbort, { once: true });
    input.media.addEventListener("error", onMediaError, { once: true });
    input.media.addEventListener("stalled", onStalled, { once: true });
    tick();
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Local extraction cancelled.", "AbortError");
}
