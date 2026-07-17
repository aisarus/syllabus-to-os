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
        // Retry while hydration, media playback and IndexedDB settle.
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
        id: "crs_local_extract",
        title: "Local Extraction Course",
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
        id: "mat_local_extract",
        title: "Three second extraction fixture",
        type: "lecture",
        sourceMode: "uploaded_file",
        fileName: "fixture.wav",
        mimeType: "audio/wav",
        fileSize: 48_044,
        courseId: "crs_local_extract",
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
        acceptedExtensions: ["wav", "webm", "ogg"],
        supportsSpeakerLabels: true,
        disclosure: "Explicit consent mock provider."
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(input, init);
  };

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
          requestId: "req_local_extract",
          language: "he",
          durationSeconds: 3,
          warnings: [],
          segments: [
            {
              id: "local_extract_segment",
              startSeconds: 0,
              endSeconds: 2.8,
              text: "בדיקת חיתוך מקומי",
              speaker: "Speaker A",
              language: "he",
              uncertain: false,
              issues: []
            }
          ]
        };
        this.responseText = JSON.stringify(this.response);
        this.onload?.();
      }, 120);
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
    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("DOM.enable"),
    ]);
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: providerMocks });
    await page.waitFor("document.readyState === 'complete'");

    const wavBase64 = createFixtureWav(3).toString("base64");
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

      const binary = atob(${JSON.stringify(wavBase64)});
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const blob = new Blob([bytes], { type: "audio/wav" });

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
          materialId: "mat_local_extract",
          uploadId: "media_local_extract",
          fileName: "fixture.wav",
          mimeType: "audio/wav",
          kind: "audio",
          size: blob.size,
          chunkSize: 8 * 1024 * 1024,
          chunkCount: 1,
          durationSeconds: 3,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        transaction.objectStore("chunks").put({
          uploadId: "media_local_extract",
          materialId: "mat_local_extract",
          index: 0,
          size: blob.size,
          sha256: "fixture",
          blob,
          createdAt: Date.now()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
      return true;
    })()`);

    await page.navigate("/app/materials/mat_local_extract");
    await page.waitForText("Возобновляемая расшифровка по диапазонам");
    await page.clickText("Создать очередь");
    await page.waitForText("0:00–0:03");
    await page.clickText("Создать локально");

    await page.waitFor(
      `(async () => {
      const db = await openDb("lamdan-resumable-transcription");
      if (!db.objectStoreNames.contains("local-clips")) { db.close(); return false; }
      const clips = await getAll(db, "local-clips");
      const jobs = await getAll(db, "jobs");
      db.close();
      return clips.length === 1 && clips[0].size > 0 &&
        clips[0].sourceUploadId === "media_local_extract" &&
        jobs[0]?.ranges?.[0]?.status === "ready";

      function openDb(name) {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(name);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
      function getAll(db, store) {
        return new Promise((resolve, reject) => {
          const request = db.transaction(store, "readonly").objectStore(store).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
    })()`,
      40_000,
    );

    const beforeReload = await inspectProof(page);
    assert(beforeReload.clipCount === 1, "The extracted range clip was not persisted.");
    assert(beforeReload.clipSize > 0, "The extracted range clip is empty.");
    assert(
      beforeReload.rangeStatus === "ready",
      "The extracted clip was not attached to its range.",
    );
    assert(beforeReload.sourceChunkCount === 0, "Local extraction created source chunks.");

    await page.reload();
    await page.waitForText("Возобновляемая расшифровка по диапазонам");
    await page.waitForText("lamdan-");
    const afterReload = await inspectProof(page);
    assert(afterReload.clipCount === 1, "The extracted range clip did not survive reload.");
    assert(afterReload.rangeStatus === "ready", "Reload did not restore the extracted clip.");

    await page.checkLabel("Я вижу провайдера");
    await page.clickText("Запустить подготовленные диапазоны");
    await page.waitFor(`(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-resumable-transcription");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const job = await new Promise((resolve, reject) => {
        const request = db.transaction("jobs", "readonly").objectStore("jobs").get("mat_local_extract");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return job?.ranges?.[0]?.status === "review_ready";
    })()`);

    await page.clickText("Загрузить объединённый draft");
    await page.waitFor(`(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-long-media");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transcript = await new Promise((resolve, reject) => {
        const request = db.transaction("transcripts", "readonly").objectStore("transcripts").get("mat_local_extract");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return transcript?.segments?.length === 1 &&
        transcript.segments[0].status === "draft" &&
        core.materialChunks.length === 0;
    })()`);

    const finalProof = await inspectProof(page);
    assert(finalProof.jobStatus === "draft_loaded", "The provider result was not loaded as draft.");
    assert(finalProof.transcriptStatuses.length === 1, "The merged local range draft is missing.");
    assert(
      finalProof.transcriptStatuses[0] === "draft",
      "The local range result was auto-approved.",
    );
    assert(
      finalProof.sourceChunkCount === 0,
      "The local range flow created source chunks automatically.",
    );
    console.log("Local range extraction browser E2E passed.");
  } finally {
    cdp?.close();
    terminateProcessGroup(chrome);
    terminateProcessGroup(preview);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function inspectProof(page) {
  return page.evaluate(`(async () => {
    const jobDb = await openDb("lamdan-resumable-transcription");
    const job = await getOne(jobDb, "jobs", "mat_local_extract");
    const clips = jobDb.objectStoreNames.contains("local-clips")
      ? await getAll(jobDb, "local-clips")
      : [];
    jobDb.close();
    const transcriptDb = await openDb("lamdan-long-media");
    const transcript = await getOne(transcriptDb, "transcripts", "mat_local_extract");
    transcriptDb.close();
    const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
    return {
      clipCount: clips.length,
      clipSize: clips[0]?.size ?? 0,
      rangeStatus: job?.ranges?.[0]?.status,
      jobStatus: job?.status,
      transcriptStatuses: transcript?.segments?.map((segment) => segment.status) ?? [],
      sourceChunkCount: core.materialChunks.length
    };

    function openDb(name) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    function getOne(db, store, key) {
      return new Promise((resolve, reject) => {
        const request = db.transaction(store, "readonly").objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    function getAll(db, store) {
      return new Promise((resolve, reject) => {
        const request = db.transaction(store, "readonly").objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  })()`);
}

function createFixtureWav(durationSeconds) {
  const sampleRate = 8_000;
  const channels = 1;
  const bitsPerSample = 16;
  const sampleCount = Math.round(sampleRate * durationSeconds);
  const dataSize = sampleCount * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 2_000);
    buffer.writeInt16LE(sample, 44 + index * 2);
  }
  return buffer;
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
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

await main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
