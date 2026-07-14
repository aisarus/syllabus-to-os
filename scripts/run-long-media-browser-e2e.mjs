import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4180;
const DEBUG_PORT = 9340;
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
  async waitFor(expression, timeout = 35_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`Boolean(${expression})`)) return;
      } catch {
        // Retry while navigation and React hydration settle.
      }
      await sleep(140);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }
  waitForText(text, timeout = 35_000) {
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
  async setFile(selector, path) {
    const { root } = await this.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await this.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    assert(nodeId, `File input was not found: ${selector}`);
    await this.send("DOM.setFileInputFiles", { nodeId, files: [path] });
  }
}

function emptyCoreData() {
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: "crs_media",
        title: "Long Lecture Course",
        status: "in_progress",
        order: 0,
        createdAt: Date.now(),
      },
    ],
    topics: [],
    notes: [],
    flashcards: [],
    quizzes: [],
    quizQuestions: [],
    quizAttempts: [],
    assignments: [],
    materials: [],
    materialChunks: [],
    materialOutputs: [],
    presentationOutlines: [],
    calendarEvents: [],
    studySessions: [],
    syllabusImports: [],
  };
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "lamdan-long-media-"));
  const mediaPath = join(profileDir, "whole-lecture.webm");
  const transcriptPath = join(profileDir, "whole-lecture.srt");
  await writeFile(mediaPath, Buffer.alloc(18 * 1024 * 1024, 0x61));
  await writeFile(
    transcriptPath,
    `1\n00:00:00,000 --> 00:10:00,000\nПервая часть полной лекции.\n\n2\n00:10:00,000 --> 00:20:00,000\nВторая часть полной лекции.\n`,
    "utf8",
  );

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
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(cdp, sessionId);
    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("DOM.enable"),
    ]);
    await page.waitFor("document.readyState === 'complete'");

    await page.evaluate(`(async () => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(emptyCoreData()))});
      localStorage.setItem("lamdan.concept-evidence.v1", JSON.stringify({ version: 1, concepts: [], evidenceEvents: [] }));
      localStorage.setItem("lamdan.quiz-attempt-details.v1", JSON.stringify({ version: 1, attempts: [] }));
      localStorage.setItem("lamdan.exam-engine.v1", JSON.stringify({ version: 1, blueprints: [], sessions: [] }));
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      await new Promise((resolve) => {
        const request = indexedDB.deleteDatabase("lamdan-long-media");
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
      return true;
    })()`);

    await page.navigate("/app/lecture-media");
    await page.waitForText("Аудио и видео лекции");
    await page.setFile('input[type="file"][accept*="audio/*"]', mediaPath);
    await page.waitForText("whole-lecture.webm");
    await page.evaluate(`(() => {
      const select = document.querySelector("select");
      if (!select) return false;
      select.value = "crs_media";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await page.clickText("Сохранить лекцию локально");
    await page.waitForText("Длинная запись лекции", 60_000);

    await page.waitFor(
      `(async () => {
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      if (core.materials.length !== 1 || core.materials[0].fileSize !== ${18 * 1024 * 1024}) return false;
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-long-media", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const manifest = await new Promise((resolve, reject) => {
        const request = db.transaction("manifests", "readonly").objectStore("manifests").get(core.materials[0].id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const chunks = await new Promise((resolve, reject) => {
        const request = db.transaction("chunks", "readonly").objectStore("chunks").index("by-upload").getAll(manifest.uploadId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return manifest.chunkCount === 3 && chunks.length === 3 && chunks.reduce((sum, item) => sum + item.size, 0) === manifest.size;
    })()`,
      60_000,
    );

    await page.clickText("Загрузить плеер");
    await page.waitFor(
      `document.querySelector("video[src^='blob:'], audio[src^='blob:']")`,
      60_000,
    );
    await page.clickText("Проверить блоки");
    await page.waitForText("SHA-256 каждого локального блока совпадает", 60_000);

    await page.setFile('input[type="file"][accept*=".srt"]', transcriptPath);
    await page.waitForText("Первая часть полной лекции");
    await page.clickText("Подтвердить все непустые");
    await page.waitForText("Применить (2)");
    await page.clickText("Применить (2)");

    await page.waitFor(
      `(() => {
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      return core.materialChunks.length === 2 &&
        core.materials[0].processingStatus === "ready" &&
        core.materialChunks.every((chunk) => chunk.section.startsWith("lecture-transcript:"));
    })()`,
      30_000,
    );

    await page.reload();
    await page.waitForText("Расшифровка по таймкодам");
    await page.waitForText("Первая часть полной лекции");
    const persisted = await page.evaluate(`(async () => {
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-long-media", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const manifests = await new Promise((resolve, reject) => {
        const request = db.transaction("manifests", "readonly").objectStore("manifests").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transcripts = await new Promise((resolve, reject) => {
        const request = db.transaction("transcripts", "readonly").objectStore("transcripts").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return {
        materials: core.materials.length,
        chunks: core.materialChunks.length,
        manifests: manifests.length,
        transcriptSegments: transcripts[0]?.segments?.length,
        approved: transcripts[0]?.segments?.filter((segment) => segment.status === "approved").length,
      };
    })()`);
    assert(persisted.materials === 1, "Long media material did not survive reload.");
    assert(persisted.chunks === 2, "Approved transcript chunks did not survive reload.");
    assert(persisted.manifests === 1, "Long media manifest did not survive reload.");
    assert(persisted.transcriptSegments === 2, "Transcript draft did not survive reload.");
    assert(persisted.approved === 2, "Approved transcript state did not survive reload.");
    console.log("Long lecture media browser E2E passed.");
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
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
