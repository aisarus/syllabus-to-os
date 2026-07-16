import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4186;
const DEBUG_PORT = 9346;
const BASE_URL = `http://${HOST}:${APP_PORT}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.onMessage(event.data));
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", rejectOpen, { once: true });
    });
    return new Cdp(socket);
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolveMessage, rejectMessage) => {
      this.pending.set(id, { resolve: resolveMessage, reject: rejectMessage });
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  onMessage(raw) {
    const message = JSON.parse(String(raw));
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result ?? {});
  }
  close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
  }
}

class Page {
  constructor(cdp, sessionId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
  }
  send(method, params = {}) {
    return this.cdp.send(method, params, this.sessionId);
  }
  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ??
          response.exceptionDetails.text ??
          "Evaluation failed",
      );
    }
    return response.result?.value;
  }
  async waitFor(expression, timeout = 45_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`Promise.resolve(${expression}).then(Boolean)`)) return;
      } catch {
        // Retry while React, Service Worker and IndexedDB settle.
      }
      await sleep(120);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }
  waitForText(text, timeout = 45_000) {
    return this.waitFor(`document.body?.innerText.includes(${JSON.stringify(text)})`, timeout);
  }
  async navigate(path) {
    await this.send("Page.navigate", { url: `${BASE_URL}${path}` });
    await this.waitFor("document.readyState === 'complete'");
  }
  async reload() {
    await this.send("Page.reload", { ignoreCache: true });
    await this.waitFor("document.readyState === 'complete'");
  }
  async clickText(text) {
    const clicked = await this.evaluate(`(() => {
      const target = [...document.querySelectorAll("button, a")].find((element) =>
        element.getClientRects().length > 0 &&
        !("disabled" in element && element.disabled) &&
        element.textContent?.replace(/\\s+/g, " ").trim().includes(${JSON.stringify(text)})
      );
      if (!target) return false;
      target.click();
      return true;
    })()`);
    assert(clicked, `Could not click text: ${text}`);
  }
  async checkLabel(text) {
    const checked = await this.evaluate(`(() => {
      const label = [...document.querySelectorAll("label")].find((element) =>
        element.getClientRects().length > 0 &&
        element.textContent?.replace(/\\s+/g, " ").includes(${JSON.stringify(text)})
      );
      const input = label?.querySelector('input[type="checkbox"]');
      if (!input || input.disabled) return false;
      if (!input.checked) input.click();
      return input.checked;
    })()`);
    assert(checked, `Could not check label: ${text}`);
  }
}

const providerMocks = String.raw`(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    if (url.endsWith("/api/ai/transcription-status")) {
      return new Response(JSON.stringify({
        ok: true,
        provider: "openai-audio",
        displayName: "OpenAI Audio Transcriptions",
        configured: true,
        model: "gpt-4o-transcribe-diarize",
        plainModel: "whisper-1",
        speakerModel: "gpt-4o-transcribe-diarize",
        maxBytes: 25165824,
        acceptedExtensions: ["webm", "ogg", "m4a", "wav"],
        supportsSpeakerLabels: true,
        disclosure: "Explicit consent mock provider."
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(input, init);
  };

  window.__localExtractionProviderRequests = 0;
  class FakeUploadTarget { onprogress = null; }
  class FakeXMLHttpRequest {
    upload = new FakeUploadTarget();
    responseType = "";
    response = null;
    responseText = "";
    status = 0;
    onload = null;
    onerror = null;
    onabort = null;
    timer = null;
    aborted = false;
    open(method, url) { this.method = method; this.url = url; }
    send(body) {
      if (!String(this.url).endsWith("/api/ai/transcribe-long-media")) {
        this.status = 404;
        this.response = { ok: false, error: "Unexpected fake XHR URL" };
        this.responseText = JSON.stringify(this.response);
        this.onload?.();
        return;
      }
      window.__localExtractionProviderRequests += 1;
      this.body = body;
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      this.timer = setTimeout(() => {
        if (this.aborted) return;
        this.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
        this.status = 200;
        this.response = {
          ok: true,
          provider: "openai-audio",
          providerDisplayName: "OpenAI Audio Transcriptions",
          model: "gpt-4o-transcribe-diarize",
          requestId: "req_local_clip",
          language: "he",
          durationSeconds: 2,
          warnings: [],
          segments: [
            {
              id: "local_clip_segment",
              startSeconds: 0.2,
              endSeconds: 1.5,
              text: "קטע שנחתך מקומית",
              speaker: "Speaker A",
              language: "he",
              uncertain: false,
              issues: []
            }
          ]
        };
        this.responseText = JSON.stringify(this.response);
        this.onload?.();
      }, 180);
    }
    abort() {
      if (this.aborted) return;
      this.aborted = true;
      if (this.timer) clearTimeout(this.timer);
      this.onabort?.();
    }
  }
  window.XMLHttpRequest = FakeXMLHttpRequest;
})();`;

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "lamdan-local-range-extraction-"));
  let preview;
  let chrome;
  let cdp;
  try {
    preview = spawn(
      npmCommand,
      ["run", "preview", "--", "--host", HOST, "--port", String(APP_PORT)],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: "ignore",
        detached: process.platform !== "win32",
      },
    );
    await waitForHttp(`${BASE_URL}/app/dashboard`, 30_000);
    chrome = spawn(
      findChrome(),
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--autoplay-policy=no-user-gesture-required",
        `--remote-debugging-address=${HOST}`,
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${profileDir}`,
        "about:blank",
      ],
      { stdio: "ignore", detached: process.platform !== "win32" },
    );
    const version = await waitForJson(`http://${HOST}:${DEBUG_PORT}/json/version`, 30_000);
    cdp = await Cdp.connect(version.webSocketDebuggerUrl);
    const { targetId } = await cdp.send("Target.createTarget", {
      url: `${BASE_URL}/app/dashboard`,
    });
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const page = new Page(cdp, sessionId);
    await Promise.all([page.send("Page.enable"), page.send("Runtime.enable")]);
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: providerMocks });
    await page.waitFor("document.readyState === 'complete'");

    await page.evaluate(`(async () => {
      localStorage.clear();
      const now = Date.now();
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      localStorage.setItem("lamdan.data.v1", JSON.stringify({
        version: 1,
        programs: [],
        courses: [{ id: "crs_extract", title: "Extraction Course", status: "in_progress", order: 0, createdAt: now }],
        topics: [], notes: [], flashcards: [], quizzes: [], quizQuestions: [], quizAttempts: [], assignments: [],
        materials: [{
          id: "mat_extract",
          title: "Six second WAV lecture",
          type: "lecture",
          sourceMode: "uploaded_file",
          fileName: "fixture.wav",
          mimeType: "audio/wav",
          fileSize: 96044,
          courseId: "crs_extract",
          tags: ["long-media"],
          rawText: "",
          processingStatus: "no_text",
          wordCount: 0,
          charCount: 0,
          extractionMethod: "manual",
          sourceLanguage: "unknown",
          createdAt: now,
          updatedAt: now
        }],
        materialChunks: [], materialOutputs: [], presentationOutlines: [], calendarEvents: [], studySessions: [], syllabusImports: []
      }));

      for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
      for (const name of [
        "lamdan-long-media",
        "lamdan-automatic-transcription",
        "lamdan-resumable-transcription",
        "lamdan-range-extraction"
      ]) {
        await new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error(name + " deletion was blocked"));
        });
      }

      function buildWav(seconds = 6, sampleRate = 8000) {
        const samples = seconds * sampleRate;
        const buffer = new ArrayBuffer(44 + samples * 2);
        const view = new DataView(buffer);
        const writeText = (offset, value) => {
          for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
        };
        writeText(0, "RIFF");
        view.setUint32(4, 36 + samples * 2, true);
        writeText(8, "WAVE");
        writeText(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeText(36, "data");
        view.setUint32(40, samples * 2, true);
        for (let index = 0; index < samples; index += 1) {
          const sample = Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.25;
          view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
        }
        return new Uint8Array(buffer);
      }

      const wav = buildWav();
      const chunkSize = 16384;
      const uploadId = "upload_extract";
      const mediaDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-long-media", 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore("manifests", { keyPath: "materialId" });
          const chunks = db.createObjectStore("chunks", { keyPath: ["uploadId", "index"] });
          chunks.createIndex("by-upload", "uploadId", { unique: false });
          chunks.createIndex("by-material", "materialId", { unique: false });
          db.createObjectStore("transcripts", { keyPath: "materialId" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = mediaDb.transaction(["manifests", "chunks"], "readwrite");
        transaction.objectStore("manifests").put({
          materialId: "mat_extract",
          uploadId,
          fileName: "fixture.wav",
          mimeType: "audio/wav",
          kind: "audio",
          size: wav.byteLength,
          chunkSize,
          chunkCount: Math.ceil(wav.byteLength / chunkSize),
          durationSeconds: 6,
          createdAt: now,
          updatedAt: now
        });
        for (let index = 0; index < Math.ceil(wav.byteLength / chunkSize); index += 1) {
          const start = index * chunkSize;
          const end = Math.min(wav.byteLength, start + chunkSize);
          transaction.objectStore("chunks").put({
            materialId: "mat_extract",
            uploadId,
            index,
            startByte: start,
            endByte: end,
            size: end - start,
            sha256: "fixture",
            blob: new Blob([wav.slice(start, end)], { type: "audio/wav" }),
            createdAt: now
          });
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      mediaDb.close();

      const queueDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-resumable-transcription", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("jobs", { keyPath: "materialId" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = queueDb.transaction("jobs", "readwrite");
        transaction.objectStore("jobs").put({
          materialId: "mat_extract",
          sourceUploadId: uploadId,
          durationSeconds: 6,
          provider: "openai-audio",
          providerDisplayName: "OpenAI Audio Transcriptions",
          model: "gpt-4o-transcribe-diarize",
          language: "he",
          requestSpeakerLabels: true,
          rangeSeconds: 2,
          overlapSeconds: 0,
          status: "planning",
          revision: 0,
          ranges: [{
            id: "range_extract",
            index: 0,
            startSeconds: 1,
            endSeconds: 3,
            status: "needs_file",
            attempt: 0,
            uploadProgress: 0,
            resultSegments: [],
            warnings: [],
            updatedAt: now
          }],
          createdAt: now,
          updatedAt: now
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      queueDb.close();
      window.confirm = () => true;
      return true;
    })()`);

    await page.navigate("/app/materials/mat_extract");
    await page.waitForText("Локально извлечь clips из оригинала");
    await page.clickText("Извлечь локально");

    await page.waitFor(`(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-range-extraction", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const clip = await new Promise((resolve, reject) => {
        const request = db.transaction("clips", "readonly").objectStore("clips").get(["mat_extract", "range_extract"]);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return clip?.blob?.size > 0 && clip?.sourceUploadId === "upload_extract";
    })()`, 60_000);

    const rangeResponse = await page.evaluate(`(async () => {
      const response = await fetch("/__lamdan_media__/mat_extract?uploadId=upload_extract", {
        headers: { Range: "bytes=0-63" }
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        status: response.status,
        contentRange: response.headers.get("content-range"),
        acceptRanges: response.headers.get("accept-ranges"),
        length: bytes.byteLength,
        riff: String.fromCharCode(...bytes.slice(0, 4))
      };
    })()`);
    assert(rangeResponse.status === 206, "Service Worker did not return HTTP 206.");
    assert(rangeResponse.contentRange?.startsWith("bytes 0-63/"), "Content-Range is wrong.");
    assert(rangeResponse.acceptRanges === "bytes", "Accept-Ranges is missing.");
    assert(rangeResponse.length === 64, "The explicit Range response returned the wrong length.");
    assert(rangeResponse.riff === "RIFF", "The streamed WAV header is corrupt.");

    await page.checkLabel("Я вижу провайдера");
    await page.clickText("Отправить извлечённые clips");
    await page.waitFor(`(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-resumable-transcription", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const job = await new Promise((resolve, reject) => {
        const request = db.transaction("jobs", "readonly").objectStore("jobs").get("mat_extract");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return job?.ranges?.[0]?.status === "review_ready" &&
        job?.ranges?.[0]?.attempt === 1 &&
        job?.ranges?.[0]?.resultSegments?.length === 1;
    })()`);
    await page.clickText("Загрузить merged draft");
    await page.waitFor(`(async () => {
      const transcriptDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-long-media", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transcript = await new Promise((resolve, reject) => {
        const request = transcriptDb.transaction("transcripts", "readonly").objectStore("transcripts").get("mat_extract");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      transcriptDb.close();
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return transcript?.segments?.length === 1 &&
        transcript.segments[0].status === "draft" &&
        transcript.segments[0].startSeconds === 1.2 &&
        core.materialChunks.length === 0;
    })()`);

    const beforeReload = await inspectProof(page);
    assert(beforeReload.clipSize > 0, "The generated local clip was not persisted.");
    assert(beforeReload.jobStatus === "draft_loaded", "The range queue was not marked draft_loaded.");
    assert(beforeReload.requestCount === 1, "The extracted clip was not sent exactly once.");
    assert(beforeReload.sourceChunkCount === 0, "Local extraction created source chunks automatically.");

    await page.reload();
    await page.waitForText("Локально извлечь clips из оригинала");
    const afterReload = await inspectProof(page);
    assert(afterReload.clipSize === beforeReload.clipSize, "The generated clip disappeared after reload.");
    assert(afterReload.jobStatus === "draft_loaded", "The loaded queue state disappeared after reload.");
    assert(afterReload.transcriptStatus === "draft", "Reload changed the transcript approval state.");
    assert(afterReload.sourceChunkCount === 0, "Reload invented source chunks.");
    console.log("Local exact-range extraction browser E2E passed.");
  } finally {
    cdp?.close();
    terminateProcessGroup(chrome);
    terminateProcessGroup(preview);
    await rm(profileDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function inspectProof(page) {
  return page.evaluate(`(async () => {
    const clipDb = await new Promise((resolve, reject) => {
      const request = indexedDB.open("lamdan-range-extraction", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const clip = await new Promise((resolve, reject) => {
      const request = clipDb.transaction("clips", "readonly").objectStore("clips").get(["mat_extract", "range_extract"]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    clipDb.close();
    const queueDb = await new Promise((resolve, reject) => {
      const request = indexedDB.open("lamdan-resumable-transcription", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const job = await new Promise((resolve, reject) => {
      const request = queueDb.transaction("jobs", "readonly").objectStore("jobs").get("mat_extract");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    queueDb.close();
    const transcriptDb = await new Promise((resolve, reject) => {
      const request = indexedDB.open("lamdan-long-media", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transcript = await new Promise((resolve, reject) => {
      const request = transcriptDb.transaction("transcripts", "readonly").objectStore("transcripts").get("mat_extract");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    transcriptDb.close();
    const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
    return {
      clipSize: clip?.size ?? 0,
      jobStatus: job?.status,
      transcriptStatus: transcript?.segments?.[0]?.status,
      requestCount: window.__localExtractionProviderRequests ?? 0,
      sourceChunkCount: core.materialChunks.length
    };
  })()`);
}

function findChrome() {
  const candidates = [
    process.env.LAM_DAN_CHROME_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync(process.platform === "win32" ? "where" : "which", [name], {
      encoding: "utf8",
    });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error("Chromium/Chrome was not found.");
}

async function waitForHttp(url, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry.
    }
    await sleep(150);
  }
  throw new Error(`Preview did not start at ${url}.`);
}

async function waitForJson(url, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Retry.
    }
    await sleep(150);
  }
  throw new Error(`Chrome debugger did not start at ${url}.`);
}

function terminateProcessGroup(handle) {
  if (!handle || handle.killed) return;
  if (process.platform !== "win32" && handle.pid) {
    try {
      process.kill(-handle.pid, "SIGTERM");
      return;
    } catch {
      // Fall back to direct child.
    }
  }
  handle.kill("SIGTERM");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

await main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
