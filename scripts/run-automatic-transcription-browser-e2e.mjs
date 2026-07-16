import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4183;
const DEBUG_PORT = 9343;
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
  async waitFor(expression, timeout = 30_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`Promise.resolve(${expression}).then(Boolean)`)) return;
      } catch {
        // Retry while React hydration and IndexedDB transactions settle.
      }
      await sleep(120);
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
        id: "crs_auto",
        title: "Automatic Transcription Course",
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
        id: "mat_auto",
        title: "Recorded lecture",
        type: "lecture",
        sourceMode: "uploaded_file",
        fileName: "lecture.mp3",
        mimeType: "audio/mpeg",
        fileSize: 1024 * 1024,
        courseId: "crs_auto",
        tags: ["long-media"],
        rawText: "",
        processingStatus: "no_text",
        processingMessage: "Recording saved locally; no transcript has been applied yet.",
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
        plainModel: "whisper-1",
        speakerModel: "gpt-4o-transcribe-diarize",
        maxBytes: 25165824,
        acceptedExtensions: ["mp3", "m4a", "wav", "webm"],
        supportsSpeakerLabels: true,
        disclosure: "Explicit consent mock provider."
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(input, init);
  };

  window.__automaticTranscriptionAttempts = 0;
  class FakeUploadTarget {
    onprogress = null;
  }
  class FakeXMLHttpRequest {
    upload = new FakeUploadTarget();
    responseType = "";
    response = null;
    responseText = "";
    status = 0;
    onload = null;
    onerror = null;
    onabort = null;
    aborted = false;
    timers = [];
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    send(body) {
      if (!String(this.url).endsWith("/api/ai/transcribe-long-media")) {
        this.status = 404;
        this.response = { ok: false, error: "Unexpected fake XHR URL" };
        this.responseText = JSON.stringify(this.response);
        this.onload?.();
        return;
      }
      const attempt = ++window.__automaticTranscriptionAttempts;
      this.body = body;
      this.timers.push(setTimeout(() => {
        if (!this.aborted) this.upload.onprogress?.({ lengthComputable: true, loaded: 35, total: 100 });
      }, 80));
      if (attempt === 1) {
        this.timers.push(setTimeout(() => {
          if (!this.aborted) this.upload.onprogress?.({ lengthComputable: true, loaded: 55, total: 100 });
        }, 1200));
        return;
      }
      this.timers.push(setTimeout(() => {
        if (this.aborted) return;
        this.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
        this.status = 200;
        this.response = {
          ok: true,
          provider: "openai-audio",
          providerDisplayName: "OpenAI Audio Transcriptions",
          model: "gpt-4o-transcribe-diarize",
          requestId: "req_browser_proof",
          language: "he",
          durationSeconds: 120,
          warnings: ["Second block requires review."],
          segments: [
            {
              id: "provider_1",
              startSeconds: 0,
              endSeconds: 35,
              text: "הקדמה למבנה השלטון",
              speaker: "Speaker A",
              language: "he",
              uncertain: false,
              issues: []
            },
            {
              id: "provider_2",
              startSeconds: 60,
              endSeconds: 95,
              text: "דיון בסמכויות הכנסת",
              speaker: "Speaker B",
              language: "he",
              uncertain: true,
              issues: ["Low average token confidence."]
            }
          ]
        };
        this.responseText = JSON.stringify(this.response);
        this.onload?.();
      }, 280));
    }
    abort() {
      if (this.aborted) return;
      this.aborted = true;
      for (const timer of this.timers) clearTimeout(timer);
      this.onabort?.();
    }
  }
  window.XMLHttpRequest = FakeXMLHttpRequest;
})();`;

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "lamdan-auto-transcription-"));
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
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(coreData()))});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");

      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase("lamdan-long-media");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error("lamdan-long-media deletion was blocked"));
      });
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase("lamdan-automatic-transcription");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error("lamdan-automatic-transcription deletion was blocked"));
      });

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
      const bytes = new Uint8Array(1024 * 1024);
      bytes.fill(7);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(["manifests", "chunks"], "readwrite");
        transaction.objectStore("manifests").put({
          materialId: "mat_auto",
          uploadId: "media_auto",
          fileName: "lecture.mp3",
          mimeType: "audio/mpeg",
          kind: "audio",
          size: blob.size,
          chunkSize: 8 * 1024 * 1024,
          chunkCount: 1,
          durationSeconds: 120,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        transaction.objectStore("chunks").put({
          uploadId: "media_auto",
          materialId: "mat_auto",
          index: 0,
          size: blob.size,
          sha256: "browser-proof",
          blob,
          createdAt: Date.now()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
      return true;
    })()`);

    await page.navigate("/app/materials/mat_auto");
    await page.waitForText("Проверяемая авторасшифровка");
    await page.waitForText("OpenAI Audio Transcriptions");
    await page.checkLabel("Я явно разрешаю эту отправку");
    await page.clickText("Отправить на расшифровку");
    await page.waitForText("Отменить");
    await page.clickText("Отменить");

    await page.waitFor(`(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-automatic-transcription", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const job = await new Promise((resolve, reject) => {
        const request = db.transaction("jobs", "readonly").objectStore("jobs").get("mat_auto");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return job?.status === "cancelled";
    })()`);

    await page.clickText("Повторить запрос");
    await page.waitFor(`(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-automatic-transcription", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const job = await new Promise((resolve, reject) => {
        const request = db.transaction("jobs", "readonly").objectStore("jobs").get("mat_auto");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return job?.status === "review_ready" && job?.resultSegments?.length === 2;
    })()`);
    await page.waitForText("Локальный candidate");
    await page.waitForText("Непокрытые интервалы");
    await page.clickText("Перенести в редактор как draft");

    await page.waitFor(`(async () => {
      const transcriptDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-long-media", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transcript = await new Promise((resolve, reject) => {
        const request = transcriptDb.transaction("transcripts", "readonly").objectStore("transcripts").get("mat_auto");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      transcriptDb.close();
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return transcript?.segments?.length === 2 &&
        transcript.segments.every((segment) => segment.status === "draft") &&
        core.materialChunks.length === 0;
    })()`);

    const beforeReload = await inspectProof(page);
    assert(
      beforeReload.jobStatus === "draft_loaded",
      "Provider candidate was not marked draft_loaded.",
    );
    assert(
      beforeReload.transcriptStatuses.every((status) => status === "draft"),
      "Provider output was auto-approved.",
    );
    assert(
      beforeReload.sourceChunkCount === 0,
      "Provider draft created source chunks before explicit review.",
    );

    await page.reload();
    await page.waitForText("Проверяемая авторасшифровка");
    const afterReload = await inspectProof(page);
    assert(
      afterReload.jobStatus === "draft_loaded",
      "Automatic transcription job did not survive reload.",
    );
    assert(
      afterReload.transcriptStatuses.length === 2,
      "Draft transcript segments disappeared after reload.",
    );
    assert(
      afterReload.transcriptStatuses.every((status) => status === "draft"),
      "Reload changed draft approval status.",
    );
    assert(
      afterReload.sourceChunkCount === 0,
      "Reload invented source chunks from an unapproved provider draft.",
    );
    assert(afterReload.attempt === 2, "Cancellation and retry history did not survive reload.");
    console.log("Reviewed automatic transcription browser E2E passed.");
  } finally {
    cdp?.close();
    terminateProcessGroup(chrome);
    terminateProcessGroup(preview);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function inspectProof(page) {
  return page.evaluate(`(async () => {
    const jobDb = await new Promise((resolve, reject) => {
      const request = indexedDB.open("lamdan-automatic-transcription", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const job = await new Promise((resolve, reject) => {
      const request = jobDb.transaction("jobs", "readonly").objectStore("jobs").get("mat_auto");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    jobDb.close();
    const transcriptDb = await new Promise((resolve, reject) => {
      const request = indexedDB.open("lamdan-long-media", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transcript = await new Promise((resolve, reject) => {
      const request = transcriptDb.transaction("transcripts", "readonly").objectStore("transcripts").get("mat_auto");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    transcriptDb.close();
    const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
    return {
      jobStatus: job?.status,
      attempt: job?.attempt,
      transcriptStatuses: transcript?.segments?.map((segment) => segment.status) ?? [],
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
  process.exitCode = 1;
});
