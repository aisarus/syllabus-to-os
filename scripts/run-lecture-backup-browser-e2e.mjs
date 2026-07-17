import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4187;
const DEBUG_PORT = 9347;
const BASE_URL = `http://${HOST}:${APP_PORT}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.onMessage(event.data));
    socket.addEventListener("close", () => this.rejectPending(new Error("CDP closed.")));
    socket.addEventListener("error", () => this.rejectPending(new Error("CDP failed.")));
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
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  onMessage(raw) {
    const message = JSON.parse(String(raw));
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result ?? {});
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  close() {
    this.rejectPending(new Error("CDP closed by test."));
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
        // Retry while hydration and IndexedDB settle.
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
}

function coreData() {
  const now = Date.now();
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: "crs_backup",
        title: "Streaming Backup Course",
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
        id: "mat_backup",
        title: "Streaming lecture fixture",
        type: "lecture",
        sourceMode: "uploaded_file",
        fileName: "streaming-fixture.wav",
        mimeType: "audio/wav",
        fileSize: 196608,
        courseId: "crs_backup",
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

const browserMocks = String.raw`(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    if (url.endsWith("/api/ai/transcription-status")) {
      return new Response(JSON.stringify({
        ok: true,
        provider: "openai-audio",
        displayName: "OpenAI Audio Transcriptions",
        configured: false,
        model: "gpt-4o-transcribe-diarize",
        maxBytes: 25165824,
        acceptedExtensions: ["wav", "webm"],
        supportsSpeakerLabels: true,
        disclosure: "Mock provider is not configured."
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(input, init);
  };

  window.__lectureBackupBlob = null;
  window.__lectureBackupWriteSizes = [];
  window.__lectureBackupAborted = false;
  window.showSaveFilePicker = async function () {
    if (this !== window) throw new Error("Save picker lost the Window receiver.");
    return {
      async createWritable() {
      const parts = [];
      return {
        async write(data) {
          const blob = data instanceof Blob ? data : new Blob([data]);
          window.__lectureBackupWriteSizes.push(blob.size);
          parts.push(blob);
        },
        async close() {
          window.__lectureBackupBlob = new Blob(parts, {
            type: "application/x-lamdan-lecture-backup"
          });
        },
        async abort() {
          window.__lectureBackupAborted = true;
        }
      };
      }
    };
  };
})();`;

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "lamdan-lecture-backup-"));
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
    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("DOM.enable"),
    ]);
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: browserMocks });
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

      const chunks = [
        new Blob([new Uint8Array(65536).fill(11)], { type: "audio/wav" }),
        new Blob([new Uint8Array(65536).fill(22)], { type: "audio/wav" }),
        new Blob([new Uint8Array(65536).fill(33)], { type: "audio/wav" })
      ];
      const hashes = [];
      for (const chunk of chunks) {
        const digest = await crypto.subtle.digest("SHA-256", await chunk.arrayBuffer());
        hashes.push([...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""));
      }

      const mediaDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-long-media", 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore("manifests", { keyPath: "materialId" });
          const chunkStore = db.createObjectStore("chunks", { keyPath: ["uploadId", "index"] });
          chunkStore.createIndex("by-upload", "uploadId", { unique: false });
          chunkStore.createIndex("by-material", "materialId", { unique: false });
          db.createObjectStore("transcripts", { keyPath: "materialId" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = mediaDb.transaction(["manifests", "chunks", "transcripts"], "readwrite");
        transaction.objectStore("manifests").put({
          materialId: "mat_backup",
          uploadId: "media_backup",
          fileName: "streaming-fixture.wav",
          mimeType: "audio/wav",
          kind: "audio",
          size: 196608,
          chunkSize: 65536,
          chunkCount: 3,
          durationSeconds: 180,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        chunks.forEach((blob, index) => transaction.objectStore("chunks").put({
          uploadId: "media_backup",
          materialId: "mat_backup",
          index,
          size: blob.size,
          sha256: hashes[index],
          blob,
          createdAt: Date.now()
        }));
        transaction.objectStore("transcripts").put({
          materialId: "mat_backup",
          sourceUploadId: "media_backup",
          segments: [{
            id: "draft_1",
            startSeconds: 0,
            endSeconds: 20,
            text: "טיוטת תמלול",
            status: "draft",
            language: "he"
          }],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      mediaDb.close();

      const autoDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-automatic-transcription", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("jobs", { keyPath: "materialId" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = autoDb.transaction("jobs", "readwrite");
        transaction.objectStore("jobs").put({
          materialId: "mat_backup",
          sourceUploadId: "media_backup",
          provider: "openai-audio",
          providerDisplayName: "OpenAI Audio Transcriptions",
          model: "gpt-4o-transcribe-diarize",
          status: "review_ready",
          attempt: 1,
          sourceFileName: "provider-copy.wav",
          sourceFileSize: 1024,
          sourceFileMimeType: "audio/wav",
          usedProviderCopy: true,
          requestSpeakerLabels: true,
          uploadProgress: 1,
          resultSegments: [{ id: "auto_1", startSeconds: 0, endSeconds: 10, text: "מועמד" }],
          warnings: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      autoDb.close();

      const clipBlob = new Blob([new Uint8Array(4096).fill(44)], { type: "audio/webm" });
      const rangeDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-resumable-transcription", 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore("jobs", { keyPath: "materialId" });
          const clips = db.createObjectStore("local-clips", { keyPath: ["materialId", "rangeId"] });
          clips.createIndex("by-material", "materialId", { unique: false });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = rangeDb.transaction(["jobs", "local-clips"], "readwrite");
        transaction.objectStore("jobs").put({
          materialId: "mat_backup",
          sourceUploadId: "media_backup",
          durationSeconds: 180,
          provider: "openai-audio",
          providerDisplayName: "OpenAI Audio Transcriptions",
          model: "gpt-4o-transcribe-diarize",
          requestSpeakerLabels: true,
          rangeSeconds: 180,
          overlapSeconds: 0,
          status: "review_ready",
          ranges: [{
            id: "range_backup",
            index: 0,
            startSeconds: 0,
            endSeconds: 180,
            status: "review_ready",
            attempt: 1,
            uploadProgress: 1,
            resultSegments: [{ id: "r1", startSeconds: 0, endSeconds: 10, text: "range result" }],
            warnings: [],
            updatedAt: Date.now()
          }],
          revision: 1,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        transaction.objectStore("local-clips").put({
          materialId: "mat_backup",
          sourceUploadId: "media_backup",
          rangeId: "range_backup",
          startSeconds: 0,
          endSeconds: 180,
          durationSeconds: 180,
          fileName: "range.webm",
          mimeType: "audio/webm",
          size: clipBlob.size,
          blob: clipBlob,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      rangeDb.close();
      return true;
    })()`);

    await page.navigate("/app/materials/mat_backup");
    await page.waitForText("Потоковая копия лекции");
    await page.clickText("Подготовить bundle");
    await page.waitForText("Ожидаемый файл");
    await page.waitForText("provider candidate");
    await page.clickText("Сохранить потоково");
    await page.waitFor("window.__lectureBackupBlob instanceof Blob");

    const proof = await page.evaluate(`(async () => {
      const blob = window.__lectureBackupBlob;
      const magic = new TextEncoder().encode("LAM_DAN_LECTURE_BACKUP_V1\\n");
      const actualMagic = new Uint8Array(await blob.slice(0, magic.length).arrayBuffer());
      if (!actualMagic.every((value, index) => value === magic[index])) {
        throw new Error("Backup magic mismatch");
      }
      let offset = magic.length;
      const records = [];
      while (offset < blob.size) {
        const lengthBytes = await blob.slice(offset, offset + 4).arrayBuffer();
        const headerLength = new DataView(lengthBytes).getUint32(0, false);
        offset += 4;
        const header = JSON.parse(await blob.slice(offset, offset + headerLength).text());
        offset += headerLength;
        const payload = blob.slice(offset, offset + header.size);
        offset += header.size;
        const digest = await crypto.subtle.digest("SHA-256", await payload.arrayBuffer());
        const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
        if (hash !== header.sha256) throw new Error("Checksum mismatch: " + header.id);
        records.push({ header, payload });
      }
      const bundleManifest = JSON.parse(await records[0].payload.text());
      const kinds = records.slice(1).map((record) => record.header.kind);
      return {
        size: blob.size,
        writeCount: window.__lectureBackupWriteSizes.length,
        maxWrite: Math.max(...window.__lectureBackupWriteSizes),
        sourceUploadId: bundleManifest.sourceUploadId,
        manifestRecordCount: bundleManifest.records.length,
        kinds,
        mediaChunks: kinds.filter((kind) => kind === "mediaChunk").length,
        aborted: window.__lectureBackupAborted,
        trailingOffset: offset
      };
    })()`);

    assert(proof.sourceUploadId === "media_backup", "Bundle lost source upload identity.");
    assert(proof.mediaChunks === 3, "Bundle did not stream every raw media chunk.");
    for (const kind of [
      "coreMaterial",
      "longMediaManifest",
      "transcriptDraft",
      "automaticTranscriptionJob",
      "resumableTranscriptionJob",
      "rangeClip",
    ]) {
      assert(proof.kinds.includes(kind), `Bundle is missing ${kind}.`);
    }
    assert(proof.manifestRecordCount === proof.kinds.length, "Manifest record count drifted.");
    assert(
      proof.writeCount > proof.kinds.length * 2,
      "Bundle was not written as framed streaming parts.",
    );
    assert(proof.maxWrite <= 65536, "A write exceeded the bounded source chunk size.");
    assert(!proof.aborted, "Successful bundle was unexpectedly aborted.");
    assert(proof.trailingOffset === proof.size, "Bundle parser did not consume the complete file.");

    await page.reload();
    await page.waitForText("Потоковая копия лекции");
    const unchanged = await page.evaluate(`(() => {
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return core.materialChunks.length === 0 && core.materials.some((item) => item.id === "mat_backup");
    })()`);
    assert(unchanged, "Local export mutated core material or source chunks.");
    console.log("Streaming lecture backup Chromium E2E passed.");
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
