import type { LongMediaManifest } from "./long-media";

const STREAM_WORKER_URL = "/long-media-stream-worker.js";
const STREAM_PATH_PREFIX = "/__lamdan_media__/";
const CONTROLLER_TIMEOUT_MS = 5_000;

export interface LongMediaStreamingCapability {
  supported: boolean;
  serviceWorker: boolean;
  mediaRecorder: boolean;
  webAudio: boolean;
  secureContext: boolean;
  reasons: string[];
}

export function inspectLongMediaStreamingCapability(): LongMediaStreamingCapability {
  if (typeof window === "undefined") {
    return {
      supported: false,
      serviceWorker: false,
      mediaRecorder: false,
      webAudio: false,
      secureContext: false,
      reasons: ["Browser APIs are unavailable during server rendering."],
    };
  }
  const serviceWorker = "serviceWorker" in navigator;
  const mediaRecorder = "MediaRecorder" in window;
  const webAudio = Boolean(window.AudioContext || window.webkitAudioContext);
  const secureContext = window.isSecureContext || window.location.hostname === "localhost";
  const reasons: string[] = [];
  if (!secureContext) reasons.push("Local range extraction requires a secure HTTPS context.");
  if (!serviceWorker) reasons.push("This browser does not support Service Workers.");
  if (!mediaRecorder) reasons.push("This browser does not support MediaRecorder.");
  if (!webAudio) reasons.push("This browser does not expose Web Audio routing.");
  return {
    supported: serviceWorker && mediaRecorder && webAudio && secureContext,
    serviceWorker,
    mediaRecorder,
    webAudio,
    secureContext,
    reasons,
  };
}

export async function ensureLongMediaStreamWorker(): Promise<ServiceWorkerRegistration> {
  const capability = inspectLongMediaStreamingCapability();
  if (!capability.serviceWorker)
    throw new Error("Service Workers are unavailable in this browser.");
  const registration = await navigator.serviceWorker.register(STREAM_WORKER_URL, { scope: "/" });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    registration.active?.postMessage({ type: "LAM_DAN_CLAIM_CLIENTS" });
    await waitForController();
  }
  if (!navigator.serviceWorker.controller) {
    throw new Error(
      "The local media stream worker is installed, but this tab must be reloaded once.",
    );
  }
  return registration;
}

export function buildLongMediaStreamUrl(manifest: LongMediaManifest): string {
  if (typeof window === "undefined") throw new Error("A browser origin is required.");
  const url = new URL(
    `${STREAM_PATH_PREFIX}${encodeURIComponent(manifest.materialId)}`,
    window.location.origin,
  );
  url.searchParams.set("uploadId", manifest.uploadId);
  return url.toString();
}

async function waitForController(): Promise<void> {
  if (navigator.serviceWorker.controller) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", finish);
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", finish, { once: true });
    window.setTimeout(finish, CONTROLLER_TIMEOUT_MS);
  });
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
