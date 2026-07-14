import { existsSync } from "node:fs";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4173;
const DEBUG_PORT = 9333;
const BASE_URL = `http://${HOST}:${APP_PORT}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const artifactDir = resolve(
  process.cwd(),
  process.env.LAM_DAN_E2E_ARTIFACT_DIR || "critical-e2e-artifacts",
);

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => this.onMessage(event.data));
  }

  static async connect(url) {
    if (typeof WebSocket !== "function") {
      throw new Error("Node 22+ with the global WebSocket API is required for browser E2E.");
    }
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", rejectOpen, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolveMessage, rejectMessage) => {
      this.pending.set(id, { resolve: resolveMessage, reject: rejectMessage });
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  on(method, sessionId, listener) {
    const key = `${sessionId ?? "browser"}:${method}`;
    const listeners = this.listeners.get(key) ?? [];
    listeners.push(listener);
    this.listeners.set(key, listeners);
  }

  onMessage(raw) {
    const message = JSON.parse(String(raw));
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      } else {
        pending.resolve(message.result ?? {});
      }
      return;
    }
    const key = `${message.sessionId ?? "browser"}:${message.method}`;
    for (const listener of this.listeners.get(key) ?? []) listener(message.params ?? {});
  }

  async close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
  }
}

class BrowserPage {
  constructor(cdpClient, contextId, targetId, sessionId, baseUrl) {
    this.cdp = cdpClient;
    this.contextId = contextId;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.baseUrl = baseUrl;
    this.consoleMessages = [];
    this.dialogWaiter = null;
  }

  static async create(cdpClient, baseUrl, downloadDir) {
    const { browserContextId } = await cdpClient.send("Target.createBrowserContext");
    await cdpClient.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      browserContextId,
      downloadPath: downloadDir,
      eventsEnabled: true,
    });
    const { targetId } = await cdpClient.send("Target.createTarget", {
      url: `${baseUrl}/app/dashboard`,
      browserContextId,
    });
    const { sessionId } = await cdpClient.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const page = new BrowserPage(cdpClient, browserContextId, targetId, sessionId, baseUrl);
    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("DOM.enable"),
    ]);
    cdpClient.on("Runtime.consoleAPICalled", sessionId, (event) => {
      const values = (event.args ?? []).map(
        (argument) => argument.value ?? argument.description ?? "",
      );
      page.consoleMessages.push(`[console.${event.type}] ${values.join(" ")}`);
    });
    cdpClient.on("Runtime.exceptionThrown", sessionId, (event) => {
      const description = event.exceptionDetails?.exception?.description;
      page.consoleMessages.push(
        `[exception] ${description ?? event.exceptionDetails?.text ?? "unknown"}`,
      );
    });
    cdpClient.on("Page.javascriptDialogOpening", sessionId, () => {
      void page.handleDialog();
    });
    await page.waitFor("document.readyState === 'complete'");
    return page;
  }

  send(method, params = {}) {
    return this.cdp.send(method, params, this.sessionId);
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text ||
          "Evaluation failed",
      );
    }
    return result.result?.value;
  }

  async seed(data) {
    await this.evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(data))});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      return true;
    })()`);
  }

  async navigate(path) {
    await this.send("Page.navigate", { url: `${this.baseUrl}${path}` });
    await this.waitFor("document.readyState === 'complete'");
    await this.waitFor("Boolean(document.body)");
  }

  async reload() {
    await this.send("Page.reload", { ignoreCache: true });
    await this.waitFor("document.readyState === 'complete'");
  }

  async waitFor(expression, timeout = 15_000) {
    const started = Date.now();
    let lastError;
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`Boolean(${expression})`)) return;
      } catch (error) {
        lastError = error;
      }
      await sleep(100);
    }
    throw new Error(
      `Timed out waiting for: ${expression}${lastError ? ` (${readableError(lastError)})` : ""}`,
    );
  }

  waitForText(text, timeout = 15_000) {
    return this.waitFor(`document.body?.innerText.includes(${JSON.stringify(text)})`, timeout);
  }

  waitForUrl(path, timeout = 15_000) {
    return this.waitFor(`location.pathname === ${JSON.stringify(path)}`, timeout);
  }

  async clickText(text, selector = "button, a") {
    const clicked = await this.evaluate(`(() => {
      const elements = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const target = elements.find((element) => {
        const visible = element.getClientRects().length > 0;
        const enabled = !("disabled" in element) || !element.disabled;
        const label = element.textContent?.replace(/\\s+/g, " ").trim() ?? "";
        return visible && enabled && label.includes(${JSON.stringify(text)});
      });
      if (!target) return false;
      target.click();
      return true;
    })()`);
    assert(clicked, `Could not find clickable text: ${text}`);
  }

  async clickTextInSection(sectionText, buttonText) {
    const clicked = await this.evaluate(`(() => {
      const section = [...document.querySelectorAll("section")].find((element) =>
        element.innerText.includes(${JSON.stringify(sectionText)})
      );
      const button = section && [...section.querySelectorAll("button")].find((element) =>
        element.getClientRects().length > 0 &&
        !element.disabled &&
        element.textContent?.replace(/\\s+/g, " ").trim().includes(${JSON.stringify(buttonText)})
      );
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert(clicked, `Could not click ${buttonText} inside ${sectionText}.`);
  }

  async clickDangerSectionButton(sectionText) {
    const clicked = await this.evaluate(`(() => {
      const section = [...document.querySelectorAll("section")].find((element) =>
        element.innerText.includes(${JSON.stringify(sectionText)})
      );
      const button = section && [...section.querySelectorAll("button")].find((element) =>
        element.getClientRects().length > 0 && !element.disabled
      );
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert(clicked, `Could not click destructive action in section: ${sectionText}`);
  }

  async clickAria(label) {
    const clicked = await this.evaluate(`(() => {
      const target = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});
      if (!target || target.getClientRects().length === 0) return false;
      target.click();
      return true;
    })()`);
    assert(clicked, `Could not find aria-label: ${label}`);
  }

  async waitForVisibleTextarea(sectionText) {
    await this.waitFor(`(() => {
      const section = [...document.querySelectorAll("section")].find((element) =>
        element.innerText.includes(${JSON.stringify(sectionText)})
      );
      const textarea = section?.querySelector("textarea");
      return Boolean(textarea && textarea.getClientRects().length > 0);
    })()`);
  }

  async fillTextareaInSection(sectionText, value) {
    const filled = await this.evaluate(`(() => {
      const section = [...document.querySelectorAll("section")].find((element) =>
        element.innerText.includes(${JSON.stringify(sectionText)})
      );
      const textarea = section?.querySelector("textarea");
      if (!textarea) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter.call(textarea, ${JSON.stringify(value)});
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    assert(filled, `Could not fill textarea inside ${sectionText}.`);
  }

  async setFileInput(selector, filePath) {
    const { root } = await this.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await this.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector,
    });
    assert(nodeId, `File input not found: ${selector}`);
    await this.send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
  }

  acceptNextDialog(timeout = 10_000) {
    assert(!this.dialogWaiter, "A dialog waiter is already active.");
    return new Promise((resolveDialog, rejectDialog) => {
      const timer = setTimeout(() => {
        this.dialogWaiter = null;
        rejectDialog(new Error("Timed out waiting for a confirmation dialog."));
      }, timeout);
      this.dialogWaiter = {
        resolve: () => {
          clearTimeout(timer);
          resolveDialog();
        },
        reject: (error) => {
          clearTimeout(timer);
          rejectDialog(error);
        },
      };
    });
  }

  async handleDialog() {
    const waiter = this.dialogWaiter;
    try {
      await this.send("Page.handleJavaScriptDialog", { accept: true });
      this.dialogWaiter = null;
      waiter?.resolve();
    } catch (error) {
      this.dialogWaiter = null;
      waiter?.reject(error);
    }
  }

  async putImage(materialId, fileName) {
    await this.evaluate(`(async () => {
      const database = await new Promise((resolveDatabase, rejectDatabase) => {
        const request = indexedDB.open("lamdan-visual-sources", 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          for (const store of ["images", "ocrDrafts", "imageProcessing", "processedImages"]) {
            if (!db.objectStoreNames.contains(store)) {
              db.createObjectStore(store, { keyPath: "materialId" });
            }
          }
        };
        request.onsuccess = () => resolveDatabase(request.result);
        request.onerror = () => rejectDatabase(request.error);
      });
      const bytes = Uint8Array.from(
        atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2l7sAAAAASUVORK5CYII="),
        (character) => character.charCodeAt(0),
      );
      const blob = new Blob([bytes], { type: "image/png" });
      await new Promise((resolveWrite, rejectWrite) => {
        const transaction = database.transaction("images", "readwrite");
        transaction.objectStore("images").put({
          materialId: ${JSON.stringify(materialId)},
          fileName: ${JSON.stringify(fileName)},
          mimeType: "image/png",
          size: blob.size,
          blob,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        transaction.oncomplete = resolveWrite;
        transaction.onerror = () => rejectWrite(transaction.error);
      });
      database.close();
      return true;
    })()`);
  }

  hasImage(materialId) {
    return this.evaluate(`(async () => {
      const database = await new Promise((resolveDatabase, rejectDatabase) => {
        const request = indexedDB.open("lamdan-visual-sources", 2);
        request.onsuccess = () => resolveDatabase(request.result);
        request.onerror = () => rejectDatabase(request.error);
      });
      if (!database.objectStoreNames.contains("images")) {
        database.close();
        return false;
      }
      const value = await new Promise((resolveRead, rejectRead) => {
        const transaction = database.transaction("images", "readonly");
        const request = transaction.objectStore("images").get(${JSON.stringify(materialId)});
        request.onsuccess = () => resolveRead(Boolean(request.result));
        request.onerror = () => rejectRead(request.error);
      });
      database.close();
      return value;
    })()`);
  }

  bodyText() {
    return this.evaluate("document.body?.innerText ?? ''");
  }

  url() {
    return this.evaluate("location.href");
  }

  async captureDiagnostics(name) {
    const safeName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const [url, body, screenshot] = await Promise.all([
      this.url().catch(() => "unknown"),
      this.bodyText().catch(() => ""),
      this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }).catch(
        () => null,
      ),
    ]);
    await writeFile(join(artifactDir, `${safeName}.txt`), `URL: ${url}\n\n${body}\n`);
    await writeFile(
      join(artifactDir, `${safeName}-console.txt`),
      `${this.consoleMessages.join("\n")}\n`,
    );
    if (screenshot?.data) {
      await writeFile(join(artifactDir, `${safeName}.png`), Buffer.from(screenshot.data, "base64"));
    }
    return { url, body };
  }

  async close() {
    await this.cdp.send("Target.disposeBrowserContext", {
      browserContextId: this.contextId,
    });
  }
}

async function flowMaterialRoute(page) {
  await page.seed(
    baseData({
      materials: [materialFixture()],
      materialChunks: [materialChunkFixture()],
    }),
  );
  await page.navigate("/app/materials");
  await page.waitForText("E2E Lecture Material");
  await page.clickText("E2E Lecture Material", "a");
  await page.waitForUrl("/app/materials/mat_e2e");
  await page.waitForText("E2E source text for a reliable material route.");
}

async function flowPhotoManualOcr(page) {
  const now = Date.now();
  const imageMaterial = {
    ...materialFixture(),
    id: "mat_photo",
    title: "E2E Notebook Photo",
    fileName: "notebook.png",
    mimeType: "image/png",
    fileSize: 68,
    rawText: "",
    processingStatus: "no_text",
    processingMessage: "Awaiting OCR review.",
    pageCount: 1,
    wordCount: 0,
    charCount: 0,
    updatedAt: now,
  };
  await page.seed(baseData({ materials: [imageMaterial] }));
  await page.putImage("mat_photo", "notebook.png");
  await page.navigate("/app/materials/mat_photo");
  await page.waitForText("Фото, OCR и рукописный текст");
  await page.clickText("Ручная расшифровка", "button");
  await page.waitForVisibleTextarea("Фото, OCR и рукописный текст");
  await page.fillTextareaInSection(
    "Фото, OCR и рукописный текст",
    "x² + 2x + 1 = 0\n(x + 1)² = 0\nx = -1",
  );
  await page.clickTextInSection("Фото, OCR и рукописный текст", "Сохранить черновик");
  await page.clickTextInSection("Фото, OCR и рукописный текст", "Применить к материалу");
  await page.waitFor(
    `JSON.parse(localStorage.getItem("lamdan.data.v1")).materials.find((item) => item.id === "mat_photo")?.rawText.includes("x² + 2x")`,
  );
  await page.reload();
  await page.waitForText("Фото, OCR и рукописный текст");
  const persisted = await page.evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem("lamdan.data.v1"));
    const material = data.materials.find((item) => item.id === "mat_photo");
    const chunks = data.materialChunks.filter((chunk) => chunk.materialId === "mat_photo");
    return { rawText: material?.rawText ?? "", chunks: chunks.length };
  })()`);
  assert(persisted.rawText.includes("x² + 2x"), "Applied OCR text did not survive reload.");
  assert(persisted.chunks > 0, "Applied OCR did not create source chunks.");
  assert(await page.hasImage("mat_photo"), "Original photo did not survive reload.");
}

async function flowFlashcards(page) {
  const now = Date.now();
  const cards = [0, 1, 2].map((index) => ({
    id: `card_${index}`,
    front: `E2E front question ${index + 1}`,
    back: `E2E back answer ${index + 1}`,
    sourceChunkIds: [],
    status: "new",
    dueAt: now - 60_000,
    interval: 0,
    createdAt: now + index,
  }));
  await page.seed(baseData({ flashcards: cards }));
  await page.navigate("/app/flashcards");
  await page.waitForText("Учебная колода");
  await page.waitForText("Повторить (3)");
  await page.waitForText("E2E front question 1");
  assert(!(await page.bodyText()).includes("E2E back answer 1"), "Both card sides are visible.");
  await page.clickAria("Показать ответ");
  await page.waitForText("E2E back answer 1");
  assert(!(await page.bodyText()).includes("E2E front question 1"), "Front remained after flip.");
  await page.clickText("Знаю", "button");
  await page.waitForText("E2E front question 2");
}

async function flowQuiz(page) {
  const now = Date.now();
  const quiz = {
    id: "quiz_e2e",
    title: "E2E Golden Quiz",
    materialId: "mat_e2e",
    createdAt: now,
  };
  const question = {
    id: "question_e2e",
    quizId: quiz.id,
    prompt: "What is the verified E2E answer?",
    options: ["Correct E2E answer", "Distractor alpha", "Distractor beta", "Distractor gamma"],
    correctIndex: 0,
    explanation:
      "[[LAM_DAN_GOLDEN_QUIZ_V1]]\n\n### Correct explanation\nThe source explicitly contains the verified E2E answer.\n\n### Memory hint\nRemember that the verified source decides the answer.\n\n### Option rationales\n1. This option matches the selected source.\n2. This option is not present in the source.\n3. This option is not present in the source.\n4. This option is not present in the source.",
    sourceChunkIds: ["chunk_e2e"],
  };
  await page.seed(
    baseData({
      materials: [materialFixture()],
      materialChunks: [materialChunkFixture("The source contains the Correct E2E answer.")],
      quizzes: [quiz],
      quizQuestions: [question],
    }),
  );
  await page.navigate("/app/quizzes");
  await page.waitForText("E2E Golden Quiz");
  await page.clickText("E2E Golden Quiz", "a");
  await page.waitForUrl("/app/quizzes/quiz_e2e");
  await page.waitForText("What is the verified E2E answer?");
  await page.clickText("Correct E2E answer", "button");
  await page.waitForText("Правильно");
  await page.waitForText("This option matches the selected source.");
  await page.clickText("Завершить квиз", "button");
  await page.waitForText("100%");
  const attempts = await page.evaluate(
    `JSON.parse(localStorage.getItem("lamdan.data.v1")).quizAttempts.filter((item) => item.quizId === "quiz_e2e").length`,
  );
  assert(attempts === 1, "Quiz attempt was not persisted.");
}

async function flowBackupRestore(page, downloadDir) {
  const imageMaterial = {
    ...materialFixture(),
    id: "mat_backup",
    title: "E2E Backup Photo",
    fileName: "backup.png",
    mimeType: "image/png",
    fileSize: 68,
  };
  await page.seed(baseData({ materials: [imageMaterial] }));
  await page.putImage("mat_backup", "backup.png");
  await page.navigate("/app/data");
  await page.waitForText("Полная ZIP-копия");
  await page.clickText("Скачать ZIP", "button");
  const zipPath = await waitForDownload(downloadDir, ".zip", 25_000);
  assert((await readFile(zipPath)).length > 100, "Full backup ZIP is unexpectedly empty.");

  const clearDialog = page.acceptNextDialog();
  await page.clickDangerSectionButton("Действие необратимо");
  await clearDialog;
  await page.waitFor(`JSON.parse(localStorage.getItem("lamdan.data.v1")).materials.length === 0`);
  assert(!(await page.hasImage("mat_backup")), "Clear all left the original image in IndexedDB.");

  await page.setFileInput('input[accept*="application/zip"]', zipPath);
  await page.waitForText("Проверенная копия готова к восстановлению", 30_000);
  const replaceDialog = page.acceptNextDialog();
  await page.clickText("Заменить всё", "button");
  await replaceDialog;
  await page.waitFor(
    `JSON.parse(localStorage.getItem("lamdan.data.v1")).materials.some((item) => item.id === "mat_backup")`,
    30_000,
  );
  assert(await page.hasImage("mat_backup"), "Full restore did not return the original image.");
}

function baseData(overrides = {}) {
  return {
    version: 1,
    programs: [],
    courses: [],
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
    ...overrides,
  };
}

function materialFixture() {
  const now = Date.now();
  return {
    id: "mat_e2e",
    title: "E2E Lecture Material",
    type: "lecture",
    sourceMode: "pasted_text",
    tags: ["e2e"],
    rawText: "E2E source text for a reliable material route.",
    processingStatus: "ready",
    processingMessage: "Ready",
    pageCount: 1,
    wordCount: 8,
    charCount: 46,
    extractionMethod: "manual",
    sourceLanguage: "en",
    createdAt: now,
    updatedAt: now,
  };
}

function materialChunkFixture(text = "E2E source text for a reliable material route.") {
  return {
    id: "chunk_e2e",
    materialId: "mat_e2e",
    order: 0,
    title: "E2E source",
    text,
    pageNumber: 1,
    section: "e2e",
    createdAt: Date.now(),
  };
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
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
      : undefined,
    process.env.PROGRAMFILES
      ? join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe")
      : undefined,
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  const command = process.platform === "win32" ? "where" : "which";
  for (const name of [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "chrome",
  ]) {
    const result = spawnSync(command, [name], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim().split(/\r?\n/)[0];
    }
  }
  throw new Error(
    "Chromium/Chrome was not found. Set LAM_DAN_CHROME_PATH to run browser E2E without downloading a browser.",
  );
}

async function waitForHttp(url, timeout, logs) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until preview is ready.
    }
    await sleep(150);
  }
  throw new Error(`Preview did not start at ${url}.\n${logs()}`);
}

async function waitForJson(url, timeout, logs) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Retry until Chrome debugger is ready.
    }
    await sleep(150);
  }
  throw new Error(`Chrome DevTools did not start at ${url}.\n${logs()}`);
}

async function waitForDownload(directory, extension, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const files = (await readdir(directory).catch(() => [])).filter(
      (file) => file.endsWith(extension) && !file.endsWith(".crdownload"),
    );
    if (files.length > 0) {
      const path = join(directory, files[0]);
      await access(path);
      return path;
    }
    await sleep(150);
  }
  throw new Error(`No ${extension} download appeared in ${directory}.`);
}

function collectLogs(processHandle, label) {
  let buffer = "";
  const append = (chunk) => {
    buffer += `[${label}] ${String(chunk)}`;
    if (buffer.length > 30_000) buffer = buffer.slice(-30_000);
  };
  processHandle.stdout?.on("data", append);
  processHandle.stderr?.on("data", append);
  return { text: () => buffer };
}

function terminate(processHandle) {
  if (!processHandle || processHandle.killed) return;
  processHandle.kill("SIGTERM");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readableError(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

async function main() {
  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });
  const workDir = await mkdtemp(join(tmpdir(), "lamdan-e2e-"));
  const downloadDir = join(workDir, "downloads");
  const profileDir = join(workDir, "chrome-profile");
  await Promise.all([
    mkdir(downloadDir, { recursive: true }),
    mkdir(profileDir, { recursive: true }),
  ]);

  let preview;
  let chrome;
  let cdp;
  let previewLogs = { text: () => "" };
  let chromeLogs = { text: () => "" };
  try {
    preview = spawn(
      npmCommand,
      ["run", "preview", "--", "--host", HOST, "--port", String(APP_PORT)],
      { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    previewLogs = collectLogs(preview, "preview");
    await waitForHttp(`${BASE_URL}/app/dashboard`, 30_000, previewLogs.text);

    const chromePath = findChrome();
    console.log(`Using Chromium: ${chromePath}`);
    chrome = spawn(
      chromePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        `--remote-debugging-address=${HOST}`,
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${profileDir}`,
        "about:blank",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    chromeLogs = collectLogs(chrome, "chrome");
    const version = await waitForJson(
      `http://${HOST}:${DEBUG_PORT}/json/version`,
      30_000,
      chromeLogs.text,
    );
    cdp = await CdpClient.connect(version.webSocketDebuggerUrl);

    const flows = [
      ["material-route", flowMaterialRoute],
      ["photo-manual-ocr", flowPhotoManualOcr],
      ["two-sided-flashcards", flowFlashcards],
      ["golden-quiz", flowQuiz],
      ["full-visual-backup", flowBackupRestore],
    ];

    for (const [name, flow] of flows) {
      const started = Date.now();
      const page = await BrowserPage.create(cdp, BASE_URL, downloadDir);
      try {
        await flow(page, downloadDir);
        console.log(`✓ ${name} (${Date.now() - started} ms)`);
      } catch (error) {
        const diagnostics = await page.captureDiagnostics(name);
        throw new Error(
          `${name} failed: ${readableError(error)}\nURL: ${diagnostics.url}\nDOM text:\n${diagnostics.body.slice(0, 5000)}`,
        );
      } finally {
        await page.close();
      }
    }

    console.log("\nAll critical browser flows passed in real Chromium.");
  } catch (error) {
    await Promise.all([
      writeFile(join(artifactDir, "preview.log"), previewLogs.text()),
      writeFile(join(artifactDir, "chrome.log"), chromeLogs.text()),
      writeFile(join(artifactDir, "failure.txt"), `${readableError(error)}\n`),
    ]);
    throw error;
  } finally {
    try {
      await cdp?.close();
    } catch {
      // Best effort cleanup.
    }
    terminate(chrome);
    terminate(preview);
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main().catch((error) => {
  console.error(`\nCritical browser E2E failed:\n${readableError(error)}`);
  process.exitCode = 1;
});
