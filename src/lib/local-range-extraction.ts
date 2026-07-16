import type { LongMediaManifest } from "./long-media";
import {
  buildLongMediaStreamUrl,
  ensureLongMediaStreamWorker,
  inspectLongMediaStreamingCapability,
} from "./long-media-streaming";

export const DEFAULT_RANGE_AUDIO_BITS_PER_SECOND = 64_000;
export const RANGE_CAPTURE_TOLERANCE_SECONDS = 1.5;
export const MAX_LOCAL_CAPTURE_SECONDS = 30 * 60;

export type LocalRangeExtractionPhase = "preparing" | "seeking" | "capturing" | "finalizing";

export interface LocalRangeExtractionProgress {
  phase: LocalRangeExtractionPhase;
  capturedSeconds: number;
  totalSeconds: number;
  fraction: number;
}

export interface LocalRangeExtractionEstimate {
  supported: boolean;
  durationSeconds: number;
  estimatedWallSeconds: number;
  estimatedBytes: number;
  mimeType?: string;
  reasons: string[];
}

export interface LocalRangeExtractionResult {
  file: File;
  blob: Blob;
  mimeType: string;
  startSeconds: number;
  endSeconds: number;
  expectedDurationSeconds: number;
  capturedDurationSeconds: number;
  measuredBlobDurationSeconds?: number;
  sourceUploadId: string;
}

export interface LocalRangeExtractionOptions {
  signal?: AbortSignal;
  audioBitsPerSecond?: number;
  onProgress?: (progress: LocalRangeExtractionProgress) => void;
}

export function estimateLocalRangeExtraction(
  startSeconds: number,
  endSeconds: number,
  audioBitsPerSecond = DEFAULT_RANGE_AUDIO_BITS_PER_SECOND,
): LocalRangeExtractionEstimate {
  const capability = inspectLongMediaStreamingCapability();
  const durationSeconds = Math.max(0, endSeconds - startSeconds);
  const mimeType = chooseRangeRecorderMimeType();
  const reasons = [...capability.reasons];
  if (!mimeType) reasons.push("This browser exposes MediaRecorder but no supported audio output format.");
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds < 0) {
    reasons.push("The extraction range is invalid.");
  }
  if (durationSeconds <= 0) reasons.push("The extraction range must have a positive duration.");
  if (durationSeconds > MAX_LOCAL_CAPTURE_SECONDS) {
    reasons.push(`One local capture is limited to ${MAX_LOCAL_CAPTURE_SECONDS / 60} minutes.`);
  }
  return {
    supported: capability.supported && Boolean(mimeType) && reasons.length === 0,
    durationSeconds,
    estimatedWallSeconds: durationSeconds,
    estimatedBytes: Math.ceil((durationSeconds * Math.max(16_000, audioBitsPerSecond)) / 8),
    mimeType: mimeType ?? undefined,
    reasons,
  };
}

export async function extractLocalAudioRange(
  manifest: LongMediaManifest,
  startSeconds: number,
  endSeconds: number,
  options: LocalRangeExtractionOptions = {},
): Promise<LocalRangeExtractionResult> {
  const audioBitsPerSecond = Math.max(
    16_000,
    Math.min(192_000, options.audioBitsPerSecond ?? DEFAULT_RANGE_AUDIO_BITS_PER_SECOND),
  );
  const estimate = estimateLocalRangeExtraction(startSeconds, endSeconds, audioBitsPerSecond);
  if (!estimate.supported || !estimate.mimeType) {
    throw new Error(estimate.reasons.join(" ") || "Local range extraction is unavailable.");
  }
  if (!manifest.durationSeconds || manifest.durationSeconds <= 0) {
    throw new Error("The lecture duration is required before local range extraction.");
  }
  if (endSeconds > manifest.durationSeconds + RANGE_CAPTURE_TOLERANCE_SECONDS) {
    throw new Error("The extraction range extends beyond the current lecture duration.");
  }
  throwIfAborted(options.signal);
  options.onProgress?.({
    phase: "preparing",
    capturedSeconds: 0,
    totalSeconds: estimate.durationSeconds,
    fraction: 0,
  });

  await ensureLongMediaStreamWorker();
  throwIfAborted(options.signal);

  const element = document.createElement(manifest.kind === "video" ? "video" : "audio");
  element.preload = "auto";
  element.playsInline = true;
  element.src = buildLongMediaStreamUrl(manifest);
  element.crossOrigin = "anonymous";
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("Web Audio is unavailable in this browser.");
  const audioContext = new AudioContextConstructor();
  const source = audioContext.createMediaElementSource(element);
  const destination = audioContext.createMediaStreamDestination();
  source.connect(destination);
  const recorder = new MediaRecorder(destination.stream, {
    mimeType: estimate.mimeType,
    audioBitsPerSecond,
  });
  const outputParts: BlobPart[] = [];
  let captureStartedAt = 0;
  let captureStoppedAt = 0;
  let pollTimer: number | undefined;
  let settled = false;

  const cleanup = async () => {
    if (pollTimer !== undefined) window.clearInterval(pollTimer);
    options.signal?.removeEventListener("abort", onAbort);
    element.pause();
    element.removeAttribute("src");
    element.load();
    source.disconnect();
    destination.stream.getTracks().forEach((track) => track.stop());
    await audioContext.close().catch(() => undefined);
  };

  const stopRecorder = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };

  const onAbort = () => {
    element.pause();
    stopRecorder();
  };

  try {
    await waitForMediaReady(element, options.signal);
    if (!Number.isFinite(element.duration) || element.duration <= 0) {
      throw new Error("The local media stream did not expose a finite duration.");
    }
    if (endSeconds > element.duration + RANGE_CAPTURE_TOLERANCE_SECONDS) {
      throw new Error("The stored recording is shorter than the requested range.");
    }
    options.onProgress?.({
      phase: "seeking",
      capturedSeconds: 0,
      totalSeconds: estimate.durationSeconds,
      fraction: 0,
    });
    await seekMediaElement(element, startSeconds, options.signal);
    await audioContext.resume();
    throwIfAborted(options.signal);

    const stopped = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) outputParts.push(event.data);
      };
      recorder.onerror = () => reject(recorder.error ?? new Error("MediaRecorder failed."));
      recorder.onstop = () => resolve();
    });
    options.signal?.addEventListener("abort", onAbort, { once: true });
    recorder.start(1_000);
    captureStartedAt = performance.now();
    await element.play();

    pollTimer = window.setInterval(() => {
      const capturedSeconds = Math.max(0, Math.min(estimate.durationSeconds, element.currentTime - startSeconds));
      options.onProgress?.({
        phase: "capturing",
        capturedSeconds,
        totalSeconds: estimate.durationSeconds,
        fraction: Math.max(0, Math.min(1, capturedSeconds / estimate.durationSeconds)),
      });
      if (element.currentTime >= endSeconds || element.ended) {
        captureStoppedAt = performance.now();
        element.pause();
        stopRecorder();
      }
    }, 50);

    await stopped;
    settled = true;
    throwIfAborted(options.signal);
    captureStoppedAt ||= performance.now();
    options.onProgress?.({
      phase: "finalizing",
      capturedSeconds: estimate.durationSeconds,
      totalSeconds: estimate.durationSeconds,
      fraction: 1,
    });
    const blob = new Blob(outputParts, { type: estimate.mimeType });
    if (blob.size === 0) throw new Error("The local range capture produced an empty audio file.");
    const capturedDurationSeconds = Math.max(0, (captureStoppedAt - captureStartedAt) / 1_000);
    if (capturedDurationSeconds + RANGE_CAPTURE_TOLERANCE_SECONDS < estimate.durationSeconds) {
      throw new Error("The local range capture ended before the requested interval was complete.");
    }
    const measuredBlobDurationSeconds = await measureBlobDuration(blob).catch(() => undefined);
    if (
      measuredBlobDurationSeconds !== undefined &&
      Math.abs(measuredBlobDurationSeconds - estimate.durationSeconds) > RANGE_CAPTURE_TOLERANCE_SECONDS
    ) {
      throw new Error(
        `The extracted clip duration (${measuredBlobDurationSeconds.toFixed(2)}s) does not match the requested range (${estimate.durationSeconds.toFixed(2)}s).`,
      );
    }
    const extension = extensionForMime(estimate.mimeType);
    const file = new File(
      [blob],
      `${sanitizeBaseName(manifest.fileName)}-${formatRangePart(startSeconds)}-${formatRangePart(endSeconds)}.${extension}`,
      { type: estimate.mimeType, lastModified: Date.now() },
    );
    return {
      file,
      blob,
      mimeType: estimate.mimeType,
      startSeconds,
      endSeconds,
      expectedDurationSeconds: estimate.durationSeconds,
      capturedDurationSeconds,
      measuredBlobDurationSeconds,
      sourceUploadId: manifest.uploadId,
    };
  } catch (error) {
    if (!settled) stopRecorder();
    if (options.signal?.aborted) throw new DOMException("Local range extraction cancelled.", "AbortError");
    throw error;
  } finally {
    await cleanup();
  }
}

export function chooseRangeRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mimeType of [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ]) {
    if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
  }
  return null;
}

function waitForMediaReady(element: HTMLMediaElement, signal?: AbortSignal): Promise<void> {
  if (element.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("Timed out loading local media metadata.")), 15_000);
    const onLoaded = () => finish();
    const onError = () => finish(new Error(element.error?.message || "The local media stream could not be decoded."));
    const onAbort = () => finish(new DOMException("Local range extraction cancelled.", "AbortError"));
    const finish = (error?: Error | DOMException) => {
      window.clearTimeout(timeout);
      element.removeEventListener("loadedmetadata", onLoaded);
      element.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    element.addEventListener("loadedmetadata", onLoaded, { once: true });
    element.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
    element.load();
  });
}

function seekMediaElement(element: HTMLMediaElement, time: number, signal?: AbortSignal): Promise<void> {
  if (Math.abs(element.currentTime - time) < 0.05) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("Timed out seeking the local recording.")), 10_000);
    const onSeeked = () => finish();
    const onError = () => finish(new Error(element.error?.message || "The local recording could not seek."));
    const onAbort = () => finish(new DOMException("Local range extraction cancelled.", "AbortError"));
    const finish = (error?: Error | DOMException) => {
      window.clearTimeout(timeout);
      element.removeEventListener("seeked", onSeeked);
      element.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    element.addEventListener("seeked", onSeeked, { once: true });
    element.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
    element.currentTime = time;
  });
}

async function measureBlobDuration(blob: Blob): Promise<number | undefined> {
  const element = document.createElement("audio");
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Timed out reading clip duration.")), 5_000);
      element.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      element.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("The extracted clip metadata could not be read."));
      };
      element.preload = "metadata";
      element.src = url;
    });
    return Number.isFinite(element.duration) && element.duration > 0 ? element.duration : undefined;
  } finally {
    element.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Local range extraction cancelled.", "AbortError");
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function sanitizeBaseName(fileName: string): string {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "lecture"
  );
}

function formatRangePart(seconds: number): string {
  return String(Math.max(0, Math.round(seconds))).padStart(5, "0");
}
