import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4179;
const DEBUG_PORT = 9339;
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
  async waitFor(expression, timeout = 25_000) {
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
  waitForText(text, timeout = 25_000) {
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
  async answerVisibleQuestion() {
    const result = await this.evaluate(`(() => {
      const prompt = document.querySelector("section h2")?.textContent ?? "";
      const expected = prompt.includes("constitutional review") ? "Independent court" : "Legislature";
      const button = [...document.querySelectorAll("section button")].find((item) =>
        item.getClientRects().length > 0 && item.textContent?.includes(expected)
      );
      if (!button) return { ok: false, prompt, expected };
      button.click();
      return { ok: true, prompt, expected };
    })()`);
    assert(result?.ok, `Could not answer visible question: ${JSON.stringify(result)}`);
  }
}

function coreData() {
  const now = Date.now();
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: "crs_exam",
        title: "Exam Engine Course",
        status: "in_progress",
        order: 0,
        createdAt: now,
      },
    ],
    topics: [],
    notes: [],
    flashcards: [],
    quizzes: [
      {
        id: "quiz_exam",
        title: "Constitution Exam Bank",
        courseId: "crs_exam",
        createdAt: now,
      },
    ],
    quizQuestions: [
      {
        id: "qq_exam_1",
        quizId: "quiz_exam",
        prompt: "Who performs constitutional review in this source?",
        options: ["Independent court", "Executive cabinet", "Municipality", "Private company"],
        correctIndex: 0,
        explanation: "The source assigns review to an independent court.",
        sourceChunkIds: ["chk_exam_1"],
      },
      {
        id: "qq_exam_2",
        quizId: "quiz_exam",
        prompt: "Which institution enacts statutes in this source?",
        options: ["Executive cabinet", "Legislature", "Independent court", "Private company"],
        correctIndex: 1,
        explanation: "The legislature enacts statutes.",
        sourceChunkIds: ["chk_exam_2"],
      },
    ],
    quizAttempts: [],
    assignments: [],
    materials: [
      {
        id: "mat_exam",
        title: "Constitution Source",
        type: "lecture",
        sourceMode: "pasted_text",
        courseId: "crs_exam",
        tags: [],
        rawText: "An independent court performs constitutional review. The legislature enacts statutes.",
        processingStatus: "ready",
        wordCount: 10,
        charCount: 86,
        extractionMethod: "manual",
        sourceLanguage: "en",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: "chk_exam_1",
        materialId: "mat_exam",
        order: 0,
        title: "Review",
        text: "An independent court performs constitutional review.",
        createdAt: now,
      },
      {
        id: "chk_exam_2",
        materialId: "mat_exam",
        order: 1,
        title: "Legislation",
        text: "The legislature enacts statutes.",
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
        id: "con_exam_1",
        courseId: "crs_exam",
        title: "Constitutional review",
        aliases: [],
        sourceChunkIds: ["chk_exam_1"],
        flashcardIds: [],
        quizQuestionIds: ["qq_exam_1"],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "con_exam_2",
        courseId: "crs_exam",
        title: "Legislation",
        aliases: [],
        sourceChunkIds: ["chk_exam_2"],
        flashcardIds: [],
        quizQuestionIds: ["qq_exam_2"],
        createdAt: now,
        updatedAt: now,
      },
    ],
    evidenceEvents: [],
  };
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "lamdan-exam-engine-"));
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
      localStorage.setItem("lamdan.exam-engine.v1", JSON.stringify({ version: 1, blueprints: [], sessions: [] }));
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      return true;
    })()`);

    await page.navigate("/app/exam-engine");
    await page.waitForText("Source-grounded экзамены");
    await page.waitForText("2/2");
    await page.evaluate("window.confirm = () => true");
    await page.clickText("Сохранить и начать");
    await page.waitForText("Замороженная экзаменационная сессия");

    await page.answerVisibleQuestion();
    await page.clickText("Дальше");
    await page.answerVisibleQuestion();
    await page.clickText("Сдать экзамен");
    await page.waitForText("Замороженный результат экзамена");

    await page.waitFor(`(() => {
      const exams = JSON.parse(localStorage.getItem("lamdan.exam-engine.v1"));
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      const details = JSON.parse(localStorage.getItem("lamdan.quiz-attempt-details.v1"));
      const concepts = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      const session = exams.sessions[0];
      return session.status === "submitted" &&
        session.result?.score === 100 &&
        session.result?.unansweredCount === 0 &&
        core.quizAttempts.length === 1 &&
        core.quizAttempts[0].score === 100 &&
        details.attempts.length === 1 &&
        details.attempts[0].mode === "exam" &&
        details.attempts[0].answers.length === 2 &&
        concepts.evidenceEvents.filter((event) => event.sourceType === "quiz_question_answer").length === 2;
    })()`, 30_000);

    await page.reload();
    await page.waitForText("Замороженный результат экзамена");
    const persisted = await page.evaluate(`(() => {
      const exams = JSON.parse(localStorage.getItem("lamdan.exam-engine.v1"));
      const details = JSON.parse(localStorage.getItem("lamdan.quiz-attempt-details.v1"));
      const concepts = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return {
        status: exams.sessions[0]?.status,
        score: exams.sessions[0]?.result?.score,
        unansweredCount: exams.sessions[0]?.result?.unansweredCount,
        detailAnswers: details.attempts[0]?.answers?.length,
        recognitionEvents: concepts.evidenceEvents.filter((event) => event.sourceType === "quiz_question_answer").length,
      };
    })()`);
    assert(persisted.status === "submitted", "Submitted exam did not survive reload.");
    assert(persisted.score === 100, "Frozen exam result changed after reload.");
    assert(persisted.unansweredCount === 0, "Exam unanswered count changed after reload.");
    assert(persisted.detailAnswers === 2, "Exam answer snapshots did not survive reload.");
    assert(persisted.recognitionEvents === 2, "Exam concept evidence duplicated or disappeared.");
    console.log("Frozen Exam Engine browser E2E passed.");
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
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
