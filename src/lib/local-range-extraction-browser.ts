import type { LongMediaManifest } from "./long-media";
import {
  LOCAL_RANGE_EXTRACTION_SEEK_TOLERANCE_SECONDS,
  createLocalRangeExtractionFileName,
  createLocalRangeExtractionIdentity,
  detectLocalRangeExtractionCapability,
  estimateLocalRangeExtraction,
  normalizeLocalRangeExtractionMimeType,
  selectLocalRangeExtractionDurationEvidence,
  validateLocalRangeExtractionPromotion,
  type LocalRangeExtractionEstimate,
  type LocalRangeExtractionProvenance,
} from "./local-range-extraction";
import {
  appendLocalRangeExtractionChunk,
  beginLocalRangeExtractionStage,
  deleteLocalRangeExtractionClip,
  finalizeLocalRangeExtractionStage,
  getLocalRangeExtractionBlob,
  getLocalRangeExtractionFile,
  localRangeExtractionProvenance,
} from "./local-range-extraction-store";

export interface LocalRangeExtractionProgress {
  clipId: string;
  phase: "capturing" | "validating" | "ready";
  bytesPersisted: number;
  expectedBytes: number;
  elapsedWallMilliseconds: number;
  estimatedWallTimeSeconds: number;
}

export interface ExtractLocalRangeInput {
  sourceBlob: Blob;
  manifest: Pick<LongMediaManifest, "materialId" | "uploadId" | "fileName" | "kind">;
  range: {
    id: string;
    startSeconds: number;
    endSeconds: number;
  };
  maxBytes: number;
  signal?: AbortSignal;
  onProgress?: (progress: LocalRangeExtractionProgress) => void;
}

export interface ExtractedLocalRange {
  file: File;
  provenance: LocalRangeExtractionProvenance;
  estimate: LocalRangeExtractionEstimate;
}

export async function extractLocalRangeFromStoredMedia(
  input: ExtractLocalRangeInput,
): Promise<ExtractedLocalRange> {
  const capability = detectLocalRangeExtractionCapability();
  if (!capability.supported || !capability.mimeType) {
    throw new Error(capability.reason ?? "Local range extraction is unavailable in this browser.");
  }
  throwIfAborted(input.signal);
  const identity = createLocalRangeExtractionIdentity({
    materialId: input.manifest.materialId,
    sourceUploadId: input.manifest.uploadId,
    rangeId: input.range.id,
    startSeconds: input.range.startSeconds,
    endSeconds: input.range.endSeconds,
  });
  const estimate = estimateLocalRangeExtraction({
    durationSeconds: identity.endSeconds - identity.startSeconds,
    maxBytes: input.maxBytes,
  });
  if (!estimate.ok) throw new Error(estimate.message ?? "This local range is not safe to record.");
  await assertLocalStorageCapacity(estimate.temporaryStorageBytes);
  throwIfAborted(input.signal);

  const stage = await beginLocalRangeExtractionStage({
    ...identity,
    fileName: createLocalRangeExtractionFileName(input.manifest.fileName, identity),
    mimeType: normalizeLocalRangeExtractionMimeType(capability.mimeType) ?? "audio/webm",
    estimatedBytes: estimate.expectedBytes,
  });
  const startedAt = performance.now();
  const busyMeter = startMainThreadBusyMeter();
  const notify = (phase: LocalRangeExtractionProgress["phase"], bytesPersisted = 0) =>
    input.onProgress?.({
      clipId: stage.id,
      phase,
      bytesPersisted,
      expectedBytes: estimate.expectedBytes,
      elapsedWallMilliseconds: Math.max(0, performance.now() - startedAt),
      estimatedWallTimeSeconds: estimate.estimatedWallTimeSeconds,
    });

  try {
    notify("capturing");
    const captured = await captureLocalAudioRange({
      sourceBlob: input.sourceBlob,
      kind: input.manifest.kind,
      startSeconds: identity.startSeconds,
      endSeconds: identity.endSeconds,
      mimeType: capability.mimeType,
      signal: input.signal,
      onChunk: async (chunk) => {
        const saved = await appendLocalRangeExtractionChunk(stage.id, chunk);
        notify("capturing", saved.byteSize);
      },
    });
    throwIfAborted(input.signal);
    notify("validating", captured.byteSize);
    const recordedBlob = await getLocalRangeExtractionBlob(stage.id, { includeStaging: true });
    if (!recordedBlob) throw new Error("The local recording disappeared before validation.");
    const actualDurationSeconds = selectLocalRangeExtractionDurationEvidence({
      containerDurationSeconds: await readMediaDuration(recordedBlob, input.signal),
      capturedDurationSeconds: captured.durationSeconds,
    });
    if (actualDurationSeconds === undefined) {
      throw new Error("The local recording has no verifiable duration evidence.");
    }
    const actualMimeType =
      normalizeLocalRangeExtractionMimeType(captured.mimeType) ?? stage.mimeType;
    const candidateFile = new File([recordedBlob], stage.fileName, {
      type: actualMimeType,
      lastModified: Date.now(),
    });
    const promotion = validateLocalRangeExtractionPromotion({
      expected: identity,
      provenance: identity,
      file: candidateFile,
      actualDurationSeconds,
      maxBytes: input.maxBytes,
    });
    if (!promotion.ok) throw new Error(promotion.message);
    const finalized = await finalizeLocalRangeExtractionStage(stage.id, {
      durationSeconds: actualDurationSeconds,
      mimeType: actualMimeType,
      wallTimeMilliseconds: Math.round(performance.now() - startedAt),
      mainThreadBusyMilliseconds: busyMeter.stop(),
    });
    const file = await getLocalRangeExtractionFile(finalized.id);
    if (!file) throw new Error("The validated local recording could not be reopened.");
    notify("ready", finalized.byteSize);
    return {
      file,
      provenance: localRangeExtractionProvenance(finalized),
      estimate,
    };
  } catch (error) {
    busyMeter.stop();
    await deleteLocalRangeExtractionClip(stage.id).catch(() => undefined);
    throw error;
  }
}

async function captureLocalAudioRange(input: {
  sourceBlob: Blob;
  kind: LongMediaManifest["kind"];
  startSeconds: number;
  endSeconds: number;
  mimeType: string;
  signal?: AbortSignal;
  onChunk: (chunk: Blob) => Promise<void>;
}): Promise<{ byteSize: number; mimeType: string; durationSeconds: number }> {
  throwIfAborted(input.signal);
  const media = document.createElement(input.kind === "video" ? "video" : "audio");
  const sourceUrl = URL.createObjectURL(input.sourceBlob);
  media.preload = "auto";
  media.muted = true;
  media.defaultPlaybackRate = 1;
  media.playbackRate = 1;
  if (input.kind === "video") (media as HTMLVideoElement).playsInline = true;
  media.style.display = "none";
  media.src = sourceUrl;
  document.body.append(media);

  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  try {
    await waitForMediaMetadata(media, input.signal);
    if (!Number.isFinite(media.duration) || media.duration < input.endSeconds - 0.01) {
      throw new Error("The local source does not contain the complete requested range.");
    }
    media.currentTime = input.startSeconds;
    await waitForSeek(media, input.startSeconds, input.signal);
    if (
      Math.abs(media.currentTime - input.startSeconds) >
      LOCAL_RANGE_EXTRACTION_SEEK_TOLERANCE_SECONDS
    ) {
      throw new Error("The browser could not seek to the exact persisted range boundary.");
    }
    if (media.playbackRate !== 1) {
      throw new Error("Local range extraction must begin at normal playback speed.");
    }
    // `loadedmetadata` only proves that the container header was parsed. Chromium can
    // expose captureStream() at that point while its decoded audio track has not been
    // attached yet, particularly for a freshly-created Blob URL. Wait until the media
    // is actually playable before asking the stream for its audio track.
    await waitForMediaCanPlay(media, input.signal);
    stream = captureMediaStream(media);
    const audioTracks = await waitForCapturedAudioTracks(stream, input.signal);
    if (audioTracks.length === 0) {
      throw new Error(
        "The local media has no capturable audio track. Choose a clip manually instead.",
      );
    }
    const audioStream = new MediaStream(audioTracks);
    recorder = new MediaRecorder(audioStream, {
      mimeType: input.mimeType,
      audioBitsPerSecond: 160_000,
    });
    return await recordUntilRangeEnd({ media, recorder, audioStream, ...input });
  } finally {
    recorder?.stream.getTracks().forEach((track) => track.stop());
    stream?.getTracks().forEach((track) => track.stop());
    media.pause();
    media.removeAttribute("src");
    media.load();
    media.remove();
    URL.revokeObjectURL(sourceUrl);
  }
}

function recordUntilRangeEnd(input: {
  media: HTMLMediaElement;
  recorder: MediaRecorder;
  audioStream: MediaStream;
  startSeconds: number;
  endSeconds: number;
  signal?: AbortSignal;
  onChunk: (chunk: Blob) => Promise<void>;
}): Promise<{ byteSize: number; mimeType: string; durationSeconds: number }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let intervalId: number | undefined;
    let timeoutId: number | undefined;
    let appendChain = Promise.resolve();
    let failure: Error | undefined;
    let byteSize = 0;
    const startMediaTime = input.media.currentTime;
    let furthestMediaTime = startMediaTime;

    const observeMediaTime = () => {
      if (Number.isFinite(input.media.currentTime)) {
        furthestMediaTime = Math.max(furthestMediaTime, input.media.currentTime);
      }
    };

    const cleanup = () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      input.media.removeEventListener("ended", onMediaEnded);
      input.signal?.removeEventListener("abort", onAbort);
    };
    const complete = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (failure) {
        reject(failure);
        return;
      }
      observeMediaTime();
      if (furthestMediaTime < input.endSeconds - LOCAL_RANGE_EXTRACTION_SEEK_TOLERANCE_SECONDS) {
        reject(new Error("The local recorder stopped before the requested range completed."));
        return;
      }
      resolve({
        byteSize,
        mimeType: input.recorder.mimeType,
        durationSeconds: Math.max(
          0,
          Math.min(input.endSeconds, furthestMediaTime) - startMediaTime,
        ),
      });
    };
    const stop = () => {
      observeMediaTime();
      input.media.pause();
      if (input.recorder.state !== "inactive") input.recorder.stop();
      else complete();
    };
    const fail = (error: Error) => {
      if (failure) return;
      failure = error;
      stop();
    };
    const onAbort = () => fail(createAbortError());
    const onMediaEnded = () => {
      observeMediaTime();
      if (
        input.media.currentTime >=
        input.endSeconds - LOCAL_RANGE_EXTRACTION_SEEK_TOLERANCE_SECONDS
      ) {
        stop();
      } else {
        fail(new Error("Source playback ended before the requested local range was captured."));
      }
    };

    input.recorder.ondataavailable = (event) => {
      if (event.data.size <= 0) return;
      byteSize += event.data.size;
      appendChain = appendChain.then(() => input.onChunk(event.data)).catch(fail);
    };
    input.recorder.onerror = () =>
      fail(new Error("The browser recorder failed while creating the local range."));
    input.recorder.onstop = () => {
      void appendChain.then(complete, (error) => fail(toError(error)));
    };
    input.media.addEventListener("ended", onMediaEnded);
    input.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      throwIfAborted(input.signal);
      input.recorder.start(1000);
      intervalId = window.setInterval(() => {
        observeMediaTime();
        if (input.media.playbackRate !== 1) {
          fail(new Error("Playback speed changed during local range extraction."));
          return;
        }
        if (input.media.currentTime >= input.endSeconds - 0.04) stop();
      }, 100);
      timeoutId = window.setTimeout(
        () => fail(new Error("Local range extraction exceeded its expected playback time.")),
        Math.ceil((input.endSeconds - input.startSeconds + 5) * 1000),
      );
      void input.media.play().catch((error) => fail(toError(error)));
    } catch (error) {
      fail(toError(error));
    }
  });
}

async function readMediaDuration(blob: Blob, signal?: AbortSignal): Promise<number | undefined> {
  throwIfAborted(signal);
  const audio = document.createElement("audio");
  const url = URL.createObjectURL(blob);
  audio.preload = "metadata";
  audio.src = url;
  try {
    await waitForMediaMetadata(audio, signal);
    return await waitForFiniteMediaDuration(audio, signal);
  } finally {
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(url);
  }
}

function captureMediaStream(media: HTMLMediaElement): MediaStream {
  const capturable = media as CapturableMediaElement;
  const capture = capturable.captureStream ?? capturable.mozCaptureStream;
  if (!capture) {
    throw new Error(
      "This browser cannot capture a local media element. Choose a clip manually instead.",
    );
  }
  return capture.call(media);
}

function waitForMediaMetadata(media: HTMLMediaElement, signal?: AbortSignal): Promise<void> {
  if (media.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return waitForMediaEvent(
    media,
    "loadedmetadata",
    signal,
    "The local media metadata could not be read.",
  );
}

function waitForMediaCanPlay(media: HTMLMediaElement, signal?: AbortSignal): Promise<void> {
  if (media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve();
  return waitForMediaEvent(
    media,
    "canplay",
    signal,
    "The local source could not prepare a playable audio track.",
  );
}

function waitForCapturedAudioTracks(
  stream: MediaStream,
  signal?: AbortSignal,
): Promise<MediaStreamTrack[]> {
  const existing = stream.getAudioTracks();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(
        new Error("The local media has no capturable audio track. Choose a clip manually instead."),
      );
    }, 1_500);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      stream.removeEventListener("addtrack", onTrack);
      signal?.removeEventListener("abort", onAbort);
    };
    const onTrack = () => {
      const tracks = stream.getAudioTracks();
      if (tracks.length === 0) return;
      cleanup();
      resolve(tracks);
    };
    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };
    stream.addEventListener("addtrack", onTrack);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function waitForFiniteMediaDuration(
  media: HTMLMediaElement,
  signal?: AbortSignal,
): Promise<number | undefined> {
  const readableDuration = (): number | undefined => {
    if (Number.isFinite(media.duration) && media.duration > 0) return media.duration;
    if (media.seekable.length <= 0) return undefined;
    const start = media.seekable.start(0);
    const end = media.seekable.end(media.seekable.length - 1);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
    return end - start;
  };
  const initial = readableDuration();
  if (initial !== undefined) return Promise.resolve(initial);
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(undefined);
    }, 3_000);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      for (const event of [
        "durationchange",
        "canplay",
        "loadeddata",
        "progress",
        "seeked",
        "timeupdate",
      ]) {
        media.removeEventListener(event, onPotentialDuration);
      }
      media.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onPotentialDuration = () => {
      const duration = readableDuration();
      if (duration === undefined) return;
      cleanup();
      resolve(duration);
    };
    const onError = () => {
      cleanup();
      reject(new Error("The local recording duration could not be decoded."));
    };
    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };
    for (const event of [
      "durationchange",
      "canplay",
      "loadeddata",
      "progress",
      "seeked",
      "timeupdate",
    ]) {
      media.addEventListener(event, onPotentialDuration);
    }
    media.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
    // Chromium may expose a valid MediaRecorder WebM with `duration === Infinity`
    // until the decoded element is asked to seek past its end. This probes only the
    // temporary local Blob and still returns undefined if the container cannot
    // produce a finite duration, so the caller never substitutes the requested span.
    if (!Number.isFinite(media.duration)) {
      try {
        media.currentTime = Number.MAX_SAFE_INTEGER;
      } catch {
        // The capture-clock fallback remains available only after metadata decoded.
      }
    }
    onPotentialDuration();
  });
}

function waitForSeek(
  media: HTMLMediaElement,
  expectedSeconds: number,
  signal?: AbortSignal,
): Promise<void> {
  if (
    !media.seeking &&
    Math.abs(media.currentTime - expectedSeconds) < LOCAL_RANGE_EXTRACTION_SEEK_TOLERANCE_SECONDS
  ) {
    return Promise.resolve();
  }
  return waitForMediaEvent(media, "seeked", signal, "The local media seek did not complete.");
}

function waitForMediaEvent(
  media: HTMLMediaElement,
  successEvent: "loadedmetadata" | "seeked" | "canplay",
  signal: AbortSignal | undefined,
  failureMessage: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      media.removeEventListener(successEvent, onSuccess);
      media.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(failureMessage));
    };
    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };
    media.addEventListener(successEvent, onSuccess, { once: true });
    media.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function assertLocalStorageCapacity(requiredBytes: number): Promise<void> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate?.quota) return;
    const remaining = estimate.quota - (estimate.usage ?? 0);
    if (remaining < requiredBytes) {
      throw new Error(
        `Not enough local browser storage. Need about ${Math.ceil(requiredBytes / 1024 / 1024)} MB free.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Not enough")) throw error;
  }
}

function startMainThreadBusyMeter(): { stop: () => number | undefined } {
  if (
    typeof PerformanceObserver === "undefined" ||
    !PerformanceObserver.supportedEntryTypes?.includes("longtask")
  ) {
    return { stop: () => undefined };
  }
  let milliseconds = 0;
  const observer = new PerformanceObserver((entries) => {
    for (const entry of entries.getEntries()) milliseconds += entry.duration;
  });
  try {
    observer.observe({ type: "longtask", buffered: true });
  } catch {
    observer.disconnect();
    return { stop: () => undefined };
  }
  let stopped = false;
  return {
    stop: () => {
      if (!stopped) {
        stopped = true;
        observer.disconnect();
      }
      return Math.round(milliseconds);
    },
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw createAbortError();
}

function createAbortError(): DOMException {
  return new DOMException("Local range extraction was cancelled.", "AbortError");
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

interface CapturableMediaElement extends HTMLMediaElement {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
}
