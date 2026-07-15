import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4178;
const DEBUG_PORT = 9338;
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
        // Retry while navigation and React hydration settle.
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

  async fillCandidateAlias(candidateTitle, value) {
    const changed = await this.evaluate(`(() => {
      const article = [...document.querySelectorAll("article")].find((item) =>
        item.textContent?.includes(${JSON.stringify(candidateTitle)})
      );
      const label = article
        ? [...article.querySelectorAll("label")].find((item) =>
            item.textContent?.includes("Алиасы через запятую")
          )
        : null;
      const input = label?.querySelector("input");
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    assert(changed, `Could not edit aliases for candidate: ${candidateTitle}`);
  }
}

function fixtureData() {
  const now = Date.now();
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: "crs_collision",
        title: "Collision Guard Course",
        status: "in_progress",
        order: 0,
        createdAt: now,
      },
    ],
    topics: [],
    notes: [
      {
        id: "note_collision_pack",
        title: "Collision Study Pack",
        content:
          "# Pack\n\n## Ключевые термины\n\n- **Судебный контроль** — проверка решений независимым судом.\n- **Разделение властей** — распределение полномочий между ветвями власти.",
        tags: ["study-pack"],
        courseId: "crs_collision",
        materialId: "mat_collision",
        sourceChunkIds: ["chk_collision"],
        createdAt: now,
        updatedAt: now,
      },
    ],
    flashcards: [],
    quizzes: [],
    quizQuestions: [],
    quizAttempts: [],
    assignments: [],
    materials: [
      {
        id: "mat_collision",
        title: "Collision Source",
        type: "lecture",
        sourceMode: "pasted_text",
        courseId: "crs_collision",
        tags: [],
        rawText: "Судебный контроль и разделение властей.",
        processingStatus: "ready",
        wordCount: 5,
        charCount: 40,
        extractionMethod: "manual",
        sourceLanguage: "ru",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: "chk_collision",
        materialId: "mat_collision",
        order: 0,
        title: "Doctrines",
        text: "Судебный контроль и разделение властей.",
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

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "lamdan-concept-collision-"));
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
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(fixtureData()))});
      localStorage.setItem("lamdan.concept-evidence.v1", JSON.stringify({ version: 1, concepts: [], evidenceEvents: [] }));
      localStorage.setItem("lamdan.quiz-attempt-details.v1", JSON.stringify({ version: 1, attempts: [] }));
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      return true;
    })()`);

    await page.navigate("/app/courses/crs_collision");
    await page.waitForText("Сначала кандидаты, потом решение человека");
    await page.clickText("Из Study Pack (1)");
    await page.waitForText("Проверка перед добавлением");
    await page.fillCandidateAlias("Судебный контроль", "Разделение властей");
    await page.waitForText("После ручных правок title или alias совпадает с другим кандидатом");
    await page.clickText("Добавить выбранные");

    await page.waitFor(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return data.concepts.length === 1 &&
        data.concepts[0].title === "Судебный контроль" &&
        data.concepts[0].aliases.includes("Разделение властей") &&
        data.concepts[0].sourceChunkIds.includes("chk_collision") &&
        data.evidenceEvents.length === 0;
    })()`);
    await page.waitForText("Разделение властей");
    await page.waitForText("Title или alias совпадает");

    await page.reload();
    await page.waitForText("Судебный контроль");
    const persisted = await page.evaluate(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return {
        concepts: data.concepts.length,
        alias: data.concepts[0]?.aliases?.[0],
        evidence: data.evidenceEvents.length,
      };
    })()`);
    assert(persisted.concepts === 1, "Edited collision guard saved more than one concept.");
    assert(persisted.alias === "Разделение властей", "Accepted concept lost its edited alias.");
    assert(persisted.evidence === 0, "Collision review unexpectedly created learning evidence.");
    console.log("Edited concept collision guard browser E2E passed.");
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
