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
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new Cdp(socket);
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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
  async waitFor(expression, timeout = 30_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`Promise.resolve(${expression}).then(Boolean)`)) return;
      } catch {
        // Hydration and IndexedDB setup can briefly make the page unavailable.
      }
      await sleep(100);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }
  waitForText(text, timeout = 30_000) {
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

function coreData() {
  const now = Date.now();
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: "crs_local",
        title: "Local extraction course",
        status: "in_progress",
        order: 0,
        createdAt: now,
      },
    ],
    topics: [],
    notes: [],
    flashcards: [],
    quizzes: [],
    quizQuestions: [],
    quizAttempts: [],
    assignments: [],
    materials: [
      {
        id: "mat_local",
        title: "Two-second local lecture",
        type: "lecture",
        sourceMode: "uploaded_file",
        fileName: "lecture.wav",
        mimeType: "audio/wav",
        fileSize: 0,
        courseId: "crs_local",
        tags: ["long-media"],
        rawText: "",
        processingStatus: "no_text",
        processingMessage: "Recording saved locally.",
        wordCount: 0,
        charCount: 0,
        extractionMethod: "manual",
        sourceLanguage: "unknown",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [],
    materialOutputs: [],
    presentationOutlines: [],
    calendarEvents: [],
    studySessions: [],
    syllabusImports: [],
  };
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
        maxBytes: 25165824,
        acceptedExtensions: ["webm"],
        supportsSpeakerLabels: true,
        disclosure: "Explicit consent mock provider."
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(input, init);
  };
  window.confirm = () => true;
  class FakeUploadTarget { onprogress = null; }
  class FakeXmlHttpRequest {
    upload = new FakeUploadTarget();
    responseType = "";
    response = null;
    responseText = "";
    status = 0;
    onload = null;
    onerror = null;
    onabort = null;
    open(method, url) { this.url = url; }
    send() {
      queueMicrotask(() => {
        if (!String(this.url).endsWith("/api/ai/transcribe-long-media")) {
          this.status = 404;
          this.response = { ok: false, error: "Unexpected mock upload URL" };
          this.responseText = JSON.stringify(this.response);
          this.onload?.();
          return;
        }
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 });
        this.status = 200;
        this.response = {
          ok: true,
          requestId: "req_local_clip",
          durationSeconds: 2,
          warnings: [],
          segments: [{ id: "local_segment", startSeconds: 0.1, endSeconds: 1.7, text: "Локальный clip проверен", language: "ru" }]
        };
        this.responseText = JSON.stringify(this.response);
        this.onload?.();
      });
    }
    abort() { this.onabort?.(); }
  }
  window.XMLHttpRequest = FakeXmlHttpRequest;
})();`;

async function main() {
  // This scenario deliberately uses Chromium's real captureStream + MediaRecorder path.
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
        `--remote-debugging-address=${HOST}`,
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${profileDir}`,
        "about:blank",
      ],
      { stdio: "ignore", detached: process.platform !== "win32" },
    );
    const version = await waitForJson(`http://${HOST}:${DEBUG_PORT}/json/version`, 30_000);
    cdp = await Cdp.connect(version.webSocketDebuggerUrl);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(cdp, sessionId);
    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("DOM.enable"),
    ]);
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: providerMocks });
    await page.navigate("/app/dashboard");

    await page.evaluate(`(async () => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(coreData()))});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      for (const name of ["lamdan-long-media", "lamdan-resumable-transcription", "lamdan-local-range-extraction"]) {
        await new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error(name + " deletion was blocked"));
        });
      }
      const wav = (() => {
        const sampleRate = 8000;
        const seconds = 2;
        const samples = sampleRate * seconds;
        const buffer = new ArrayBuffer(44 + samples * 2);
        const view = new DataView(buffer);
        const write = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
        write(0, "RIFF");
        view.setUint32(4, 36 + samples * 2, true);
        write(8, "WAVEfmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        write(36, "data");
        view.setUint32(40, samples * 2, true);
        for (let index = 0; index < samples; index += 1) {
          view.setInt16(44 + index * 2, Math.round(Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 8000), true);
        }
        return new Blob([buffer], { type: "audio/wav" });
      })();
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-long-media", 1);
        request.onupgradeneeded = () => {
          const next = request.result;
          next.createObjectStore("manifests", { keyPath: "materialId" });
          const chunks = next.createObjectStore("chunks", { keyPath: ["uploadId", "index"] });
          chunks.createIndex("by-upload", "uploadId", { unique: false });
          chunks.createIndex("by-material", "materialId", { unique: false });
          next.createObjectStore("transcripts", { keyPath: "materialId" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(["manifests", "chunks"], "readwrite");
        transaction.objectStore("manifests").put({
          materialId: "mat_local", uploadId: "media_local", fileName: "lecture.wav", mimeType: "audio/wav", kind: "audio",
          size: wav.size, chunkSize: 8 * 1024 * 1024, chunkCount: 1, durationSeconds: 2, createdAt: Date.now(), updatedAt: Date.now()
        });
        transaction.objectStore("chunks").put({
          uploadId: "media_local", materialId: "mat_local", index: 0, size: wav.size, sha256: "browser-proof", blob: wav, createdAt: Date.now()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
      return true;
    })()`);

    await page.navigate("/app/materials/mat_local");
    await page.waitForText("Возобновляемая расшифровка по диапазонам");
    await page.clickText("Создать очередь");
    await page.waitForText("0:00–0:02");
    await page.clickText("Извлечь локально");
    await waitForLocalExtraction(page);
    await page.checkLabel("Я вижу провайдера");
    await page.clickText("Запустить выбранные диапазоны");
    await page.waitFor(
      `(async () => {
      const job = await readRecord("lamdan-resumable-transcription", "jobs", "mat_local");
      const clip = (await readAll("lamdan-local-range-extraction", "clips"))[0];
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return job?.ranges?.[0]?.status === "review_ready" &&
        job?.ranges?.[0]?.localExtraction?.sourceUploadId === "media_local" &&
        clip?.status === "ready" && clip?.chunkCount > 0 &&
        Math.abs(clip?.durationSeconds - 2) < 1.5 &&
        core.materialChunks.length === 0;
      function readRecord(database, store, id) {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(database, 1);
          request.onsuccess = () => {
            const db = request.result;
            const item = db.transaction(store, "readonly").objectStore(store).get(id);
            item.onsuccess = () => { resolve(item.result); db.close(); };
            item.onerror = () => reject(item.error);
          };
          request.onerror = () => reject(request.error);
        });
      }
      function readAll(database, store) {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(database, 1);
          request.onsuccess = () => {
            const db = request.result;
            const items = db.transaction(store, "readonly").objectStore(store).getAll();
            items.onsuccess = () => { resolve(items.result); db.close(); };
            items.onerror = () => reject(items.error);
          };
          request.onerror = () => reject(request.error);
        });
      }
    })()`,
      30_000,
    );
    await page.clickText("Загрузить объединённый draft");
    await page.waitFor(`(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-long-media", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transcript = await new Promise((resolve, reject) => {
        const request = db.transaction("transcripts", "readonly").objectStore("transcripts").get("mat_local");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return transcript?.segments?.length === 1 && transcript.segments.every((segment) => segment.status === "draft") && core.materialChunks.length === 0;
    })()`);
    await page.reload();
    await page.waitForText("Возобновляемая расшифровка по диапазонам");
    const proof = await page.evaluate(`(async () => {
      const job = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-resumable-transcription", 1);
        request.onsuccess = () => {
          const db = request.result;
          const item = db.transaction("jobs", "readonly").objectStore("jobs").get("mat_local");
          item.onsuccess = () => { resolve(item.result); db.close(); };
          item.onerror = () => reject(item.error);
        };
        request.onerror = () => reject(request.error);
      });
      const clips = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-local-range-extraction", 1);
        request.onsuccess = () => {
          const db = request.result;
          const items = db.transaction("clips", "readonly").objectStore("clips").getAll();
          items.onsuccess = () => { resolve(items.result); db.close(); };
          items.onerror = () => reject(items.error);
        };
        request.onerror = () => reject(request.error);
      });
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return { jobStatus: job?.status, clipStatus: clips?.[0]?.status, sourceChunks: core.materialChunks.length };
    })()`);
    assert(
      proof.jobStatus === "draft_loaded",
      "The merged provider result did not remain a draft.",
    );
    assert(proof.clipStatus === "ready", "The locally extracted clip did not survive reload.");
    assert(proof.sourceChunks === 0, "Local extraction created source chunks automatically.");
    console.log("Local range extraction browser E2E passed.");
  } finally {
    cdp?.close();
    terminateProcessGroup(chrome);
    terminateProcessGroup(preview);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
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
      if ((await fetch(url)).ok) return;
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
      // Fall back to the direct child.
    }
  }
  handle.kill("SIGTERM");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForLocalExtraction(page, timeout = 20_000) {
  try {
    await page.waitForText("Локально извлечён", timeout);
  } catch (error) {
    // Do not issue a long-lived Promise through CDP here: Chromium may collect
    // it while IndexedDB is resolving. The synchronous DOM snapshot is stable
    // and contains the visible local-capture failure/toast when one occurs.
    const diagnostics = await page.evaluate(`(() => ({
      pageText: document.body?.innerText.slice(-1_500),
      toasts: [...document.querySelectorAll('[data-sonner-toast]')]
        .map((toast) => toast.textContent?.replace(/\\s+/g, " ").trim())
        .filter(Boolean),
    }))()`);
    throw new Error(
      `Local extraction did not become ready: ${JSON.stringify(diagnostics)}; ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

await main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
