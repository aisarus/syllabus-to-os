import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4185;
const DEBUG_PORT = 9345;
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
  async clickNthText(text, index) {
    const clicked = await this.evaluate(`(() => {
      const targets = [...document.querySelectorAll("button, a")].filter((element) =>
        element.getClientRects().length > 0 &&
        !("disabled" in element && element.disabled) &&
        element.textContent?.replace(/\\s+/g, " ").trim().includes(${JSON.stringify(text)})
      );
      const target = targets[${index}];
      if (!target) return false;
      target.click();
      return true;
    })()`);
    assert(clicked, `Could not click ${text} at index ${index}`);
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
  async setHiddenFileInput(filePath) {
    await this.send("DOM.enable");
    const { root } = await this.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await this.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: 'input[type="file"]',
    });
    assert(nodeId, "Hidden range file input was not found.");
    await this.send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
  }
}

function coreData() {
  const now = Date.now();
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: "crs_ranges",
        title: "Resumable Transcription Course",
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
        id: "mat_ranges",
        title: "Twenty five minute lecture",
        type: "lecture",
        sourceMode: "uploaded_file",
        fileName: "lecture.mp3",
        mimeType: "audio/mpeg",
        fileSize: 1024,
        courseId: "crs_ranges",
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

  window.__resumableAttempts = 0;
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
    timer = null;
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
      const attempt = ++window.__resumableAttempts;
      this.body = body;
      this.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 });
      this.timer = setTimeout(() => {
        if (this.aborted) return;
        this.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
        if (attempt === 2) {
          this.status = 502;
          this.response = { ok: false, error: "Mock provider timeout for range two." };
          this.responseText = JSON.stringify(this.response);
          this.onload?.();
          return;
        }
        this.status = 200;
        this.response = attempt === 1
          ? {
              ok: true,
              provider: "openai-audio",
              providerDisplayName: "OpenAI Audio Transcriptions",
              model: "gpt-4o-transcribe-diarize",
              requestId: "req_range_one",
              language: "he",
              durationSeconds: 900,
              warnings: [],
              segments: [
                {
                  id: "range_one_intro",
                  startSeconds: 0,
                  endSeconds: 40,
                  text: "פתיחה לשיעור הארוך",
                  speaker: "Speaker A",
                  language: "he",
                  uncertain: false,
                  issues: []
                },
                {
                  id: "shared_left",
                  startSeconds: 890,
                  endSeconds: 900,
                  text: "משפט משותף בחיתוך",
                  speaker: "Speaker A",
                  language: "he",
                  uncertain: false,
                  issues: []
                }
              ]
            }
          : {
              ok: true,
              provider: "openai-audio",
              providerDisplayName: "OpenAI Audio Transcriptions",
              model: "gpt-4o-transcribe-diarize",
              requestId: "req_range_two_retry",
              language: "he",
              durationSeconds: 602,
              warnings: ["Review the second speaker."],
              segments: [
                {
                  id: "shared_right",
                  startSeconds: 0,
                  endSeconds: 5,
                  text: "משפט משותף בחיתוך",
                  speaker: "Speaker A",
                  language: "he",
                  uncertain: false,
                  issues: []
                },
                {
                  id: "range_two_new",
                  startSeconds: 10,
                  endSeconds: 30,
                  text: "המשך הדיון אחרי החיתוך",
                  speaker: "Speaker B",
                  language: "he",
                  uncertain: true,
                  issues: ["Mock low confidence."]
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
  const profileDir = await mkdtemp(join(tmpdir(), "lamdan-resumable-transcription-"));
  const clipOne = join(profileDir, "lecture-00-15.mp3");
  const clipTwo = join(profileDir, "lecture-15-25.mp3");
  await writeFile(clipOne, Buffer.alloc(4096, 1));
  await writeFile(clipTwo, Buffer.alloc(4096, 2));
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
    // Attach and install mocks before entering an HTTP origin. A target created
    // on the app URL can still be evaluated while its initial document is
    // about:blank, where localStorage and IndexedDB deliberately throw.
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const page = new Page(cdp, sessionId);
    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("DOM.enable"),
    ]);
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: providerMocks });
    await page.navigate("/app/dashboard");
    await page.waitFor("document.readyState === 'complete'");

    await page.evaluate(`(async () => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(coreData()))});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");

      for (const name of [
        "lamdan-long-media",
        "lamdan-automatic-transcription",
        "lamdan-resumable-transcription"
      ]) {
        await new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error(name + " deletion was blocked"));
        });
      }

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
        const transaction = db.transaction("manifests", "readwrite");
        transaction.objectStore("manifests").put({
          materialId: "mat_ranges",
          uploadId: "media_ranges",
          fileName: "lecture.mp3",
          mimeType: "audio/mpeg",
          kind: "audio",
          size: 1024,
          chunkSize: 8 * 1024 * 1024,
          chunkCount: 1,
          durationSeconds: 1500,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
      return true;
    })()`);

    await page.navigate("/app/materials/mat_ranges");
    await page.waitForText("Возобновляемая расшифровка по диапазонам");
    await page.clickText("Создать очередь");
    await page.waitForText("0:00–15:00");
    await page.waitForText("14:58–25:00");

    await page.clickNthText("Выбрать clip", 0);
    await page.setHiddenFileInput(clipOne);
    await page.waitForText("lecture-00-15.mp3");
    await page.clickNthText("Выбрать clip", 1);
    await page.setHiddenFileInput(clipTwo);
    await page.waitForText("lecture-15-25.mp3");
    await page.checkLabel("Я вижу провайдера");
    await page.clickText("Запустить выбранные диапазоны");

    await page.waitFor(`(async () => {
      const db = await openDb("lamdan-resumable-transcription");
      const job = await readJob(db, "mat_ranges");
      db.close();
      return job?.ranges?.[0]?.status === "review_ready" &&
        job?.ranges?.[1]?.status === "failed" &&
        job?.ranges?.[0]?.resultSegments?.length === 2;

      function openDb(name) {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(name, 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
      function readJob(db, id) {
        return new Promise((resolve, reject) => {
          const request = db.transaction("jobs", "readonly").objectStore("jobs").get(id);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
    })()`);
    await page.waitForText("Mock provider timeout for range two.");

    await page.clickNthText("Выбрать clip", 1);
    await page.setHiddenFileInput(clipTwo);
    await page.checkLabel("Я вижу провайдера");
    await page.clickText("Запустить выбранные диапазоны");

    await page.waitFor(`(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-resumable-transcription", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const job = await new Promise((resolve, reject) => {
        const request = db.transaction("jobs", "readonly").objectStore("jobs").get("mat_ranges");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return job?.status === "review_ready" &&
        job?.ranges?.every((range) => range.status === "review_ready") &&
        job?.ranges?.[1]?.attempt === 2;
    })()`);

    await page.clickText("Загрузить объединённый draft");
    await page.waitFor(`(async () => {
      const transcriptDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-long-media", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transcript = await new Promise((resolve, reject) => {
        const request = transcriptDb.transaction("transcripts", "readonly").objectStore("transcripts").get("mat_ranges");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      transcriptDb.close();
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return transcript?.segments?.length === 3 &&
        transcript.segments.every((segment) => segment.status === "draft") &&
        core.materialChunks.length === 0;
    })()`);

    const beforeReload = await inspectProof(page);
    assert(beforeReload.jobStatus === "draft_loaded", "Range queue was not marked draft_loaded.");
    assert(beforeReload.completedRanges === 2, "Both completed ranges were not persisted.");
    assert(beforeReload.secondAttempt === 2, "Isolated retry history was not persisted.");
    assert(
      beforeReload.transcriptStatuses.length === 3,
      "Overlap merge produced the wrong draft size.",
    );
    assert(
      beforeReload.transcriptStatuses.every((status) => status === "draft"),
      "Merged range output was auto-approved.",
    );
    assert(beforeReload.sourceChunkCount === 0, "Range draft created source chunks automatically.");

    await page.reload();
    await page.waitForText("Возобновляемая расшифровка по диапазонам");
    const afterReload = await inspectProof(page);
    assert(afterReload.jobStatus === "draft_loaded", "Range queue did not survive reload.");
    assert(afterReload.completedRanges === 2, "Completed range results disappeared after reload.");
    assert(afterReload.secondAttempt === 2, "Retry history disappeared after reload.");
    assert(
      afterReload.transcriptStatuses.length === 3,
      "Merged transcript disappeared after reload.",
    );
    assert(
      afterReload.transcriptStatuses.every((status) => status === "draft"),
      "Reload changed range draft approval status.",
    );
    assert(afterReload.sourceChunkCount === 0, "Reload invented source chunks from range drafts.");
    console.log("Resumable transcription browser E2E passed.");
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
      const request = indexedDB.open("lamdan-resumable-transcription", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const job = await new Promise((resolve, reject) => {
      const request = jobDb.transaction("jobs", "readonly").objectStore("jobs").get("mat_ranges");
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
      const request = transcriptDb.transaction("transcripts", "readonly").objectStore("transcripts").get("mat_ranges");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    transcriptDb.close();
    const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
    return {
      jobStatus: job?.status,
      completedRanges: job?.ranges?.filter((range) => range.status === "review_ready").length ?? 0,
      secondAttempt: job?.ranges?.[1]?.attempt,
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
  process.exit(1);
});
