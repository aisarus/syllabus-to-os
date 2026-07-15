import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4177;
const DEBUG_PORT = 9337;
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
  async waitFor(expression, timeout = 20_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`Boolean(${expression})`)) return;
      } catch {
        // Retry while navigation and hydration settle.
      }
      await sleep(120);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }
  waitForText(text, timeout = 20_000) {
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
  async fill(selector, value) {
    const changed = await this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      const setter = Object.getOwnPropertyDescriptor(
        element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    assert(changed, `Could not fill: ${selector}`);
  }
  async checkByLabelText(text) {
    const checked = await this.evaluate(`(() => {
      const label = [...document.querySelectorAll("label")].find((item) =>
        item.textContent?.replace(/\\s+/g, " ").includes(${JSON.stringify(text)})
      );
      const input = label?.querySelector('input[type="checkbox"]');
      if (!input) return false;
      input.click();
      return true;
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
        id: "crs_open",
        title: "Open Answer Course",
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
        id: "mat_open",
        title: "Judicial Review Source",
        type: "lecture",
        sourceMode: "pasted_text",
        courseId: "crs_open",
        tags: [],
        rawText: "An independent court reviews a government decision under the legal framework.",
        processingStatus: "ready",
        wordCount: 11,
        charCount: 78,
        extractionMethod: "manual",
        sourceLanguage: "en",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: "chk_open",
        materialId: "mat_open",
        order: 0,
        title: "Judicial review definition",
        text: "An independent court reviews a government decision under the legal framework.",
        createdAt: now,
      },
    ],
    materialOutputs: [],
    presentationOutlines: [],
    calendarEvents: [],
    studySessions: [],
    syllabusImports: [],
  };
}

function conceptData() {
  const now = Date.now();
  return {
    version: 1,
    concepts: [
      {
        id: "con_open",
        courseId: "crs_open",
        title: "Judicial review",
        description: "Review of a government decision by an independent court.",
        aliases: [],
        sourceChunkIds: ["chk_open"],
        flashcardIds: [],
        quizQuestionIds: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    evidenceEvents: [],
  };
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "lamdan-open-answer-e2e-"));
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
    await page.waitFor("document.readyState === 'complete'");

    await page.evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(coreData()))});
      localStorage.setItem("lamdan.concept-evidence.v1", ${JSON.stringify(JSON.stringify(conceptData()))});
      localStorage.setItem("lamdan.quiz-attempt-details.v1", JSON.stringify({ version: 1, attempts: [] }));
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      return true;
    })()`);

    await page.navigate("/app/courses/crs_open");
    await page.waitForText("Открытый ответ и исправление ошибки");
    await page.fill(
      'input[placeholder="Объясни понятие своими словами"]',
      "Кто осуществляет судебный контроль?",
    );
    await page.fill(
      'textarea[placeholder="Напиши полный ответ до проверки"]',
      "Правительство самостоятельно проверяет собственное решение без участия суда.",
    );
    await page.clickText("Проверить самостоятельно");
    await page.checkByLabelText("Я лично проверил ответ");
    await page.clickText("Сохранить evidence");

    await page.waitFor(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return data.evidenceEvents.length === 1 &&
        data.evidenceEvents[0].sourceType === "open_answer_review" &&
        data.evidenceEvents[0].reviewMode === "human" &&
        data.evidenceEvents[0].outcome === "failure" &&
        data.evidenceEvents[0].sourceChunkIds.includes("chk_open") &&
        data.evidenceEvents[0].response.includes("Правительство");
    })()`);
    const originalFailureId = await page.evaluate(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return data.evidenceEvents[0].id;
    })()`);

    await page.waitForText("Ошибки, которые можно исправить");
    await page.clickText("Исправить");
    await page.fill(
      'textarea[placeholder="Напиши полный ответ до проверки"]',
      "Независимый суд проверяет решение правительства в рамках правовой системы.",
    );
    await page.clickText("Проверить самостоятельно");
    await page.clickText("Успех");
    await page.checkByLabelText("Я лично проверил ответ");
    await page.clickText("Сохранить попытку исправления");

    await page.waitFor(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      const failure = data.evidenceEvents.find((event) => event.id === ${JSON.stringify(originalFailureId)});
      const repair = data.evidenceEvents.find((event) => event.repairOfEvidenceId === ${JSON.stringify(originalFailureId)});
      return data.evidenceEvents.length === 2 &&
        failure?.outcome === "failure" &&
        repair?.outcome === "success" &&
        repair?.reviewMode === "human" &&
        repair?.response.includes("Независимый суд");
    })()`);

    await page.reload();
    await page.waitForText("История открытых ответов");
    const persisted = await page.evaluate(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return {
        count: data.evidenceEvents.length,
        originalStillExists: data.evidenceEvents.some((event) => event.id === ${JSON.stringify(originalFailureId)} && event.outcome === "failure"),
        repairLinked: data.evidenceEvents.some((event) => event.repairOfEvidenceId === ${JSON.stringify(originalFailureId)} && event.outcome === "success"),
        humanOnly: data.evidenceEvents.every((event) => event.reviewMode === "human"),
      };
    })()`);
    assert(persisted.count === 2, "Open-answer history did not survive reload.");
    assert(persisted.originalStillExists, "Repair overwrote or deleted the original failure.");
    assert(persisted.repairLinked, "Repair attempt lost its link to the original failure.");
    assert(persisted.humanOnly, "Manual browser flow unexpectedly became objective AI evidence.");
    console.log("Open-answer evidence and mistake repair browser E2E passed.");
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
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim().split(/\r?\n/)[0];
    }
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
      // Fall back to the direct child.
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
