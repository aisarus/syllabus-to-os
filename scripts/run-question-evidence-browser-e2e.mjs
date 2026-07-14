import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4174;
const DEBUG_PORT = 9334;
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
        response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? "Evaluation failed",
      );
    }
    return response.result?.value;
  }

  async waitFor(expression, timeout = 15_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`Boolean(${expression})`)) return;
      } catch {
        // Retry while navigation/hydration settles.
      }
      await sleep(100);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }

  waitForText(text, timeout = 15_000) {
    return this.waitFor(`document.body?.innerText.includes(${JSON.stringify(text)})`, timeout);
  }

  async navigate(path) {
    await this.send("Page.navigate", { url: `${BASE_URL}${path}` });
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

  async reload() {
    await this.send("Page.reload", { ignoreCache: true });
    await this.waitFor("document.readyState === 'complete'");
  }
}

function fixtureData() {
  const now = Date.now();
  return {
    version: 1,
    programs: [],
    courses: [{ id: "crs_evidence", title: "Evidence Course", status: "in_progress", order: 0, createdAt: now }],
    topics: [],
    notes: [],
    flashcards: [],
    quizzes: [{ id: "quiz_evidence", title: "Question Evidence Quiz", courseId: "crs_evidence", createdAt: now }],
    quizQuestions: [
      {
        id: "qq_evidence",
        quizId: "quiz_evidence",
        prompt: "Which answer should become recognition evidence?",
        options: ["Verified answer", "Distractor one", "Distractor two", "Distractor three"],
        correctIndex: 0,
        explanation:
          "[[LAM_DAN_GOLDEN_QUIZ_V1]]\n\n### Correct explanation\nThe verified answer is correct.\n\n### Memory hint\nChoose the verified answer.\n\n### Option rationales\n1. Supported.\n2. Unsupported.\n3. Unsupported.\n4. Unsupported.",
        sourceChunkIds: ["chk_evidence"],
      },
    ],
    quizAttempts: [],
    assignments: [],
    materials: [
      {
        id: "mat_evidence",
        title: "Evidence Source",
        type: "lecture",
        sourceMode: "pasted_text",
        courseId: "crs_evidence",
        tags: [],
        rawText: "The verified answer is correct.",
        processingStatus: "ready",
        wordCount: 6,
        charCount: 31,
        extractionMethod: "manual",
        sourceLanguage: "en",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: "chk_evidence",
        materialId: "mat_evidence",
        order: 0,
        text: "The verified answer is correct.",
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
        id: "con_evidence",
        courseId: "crs_evidence",
        title: "Recognition concept",
        aliases: [],
        sourceChunkIds: ["chk_evidence"],
        flashcardIds: [],
        quizQuestionIds: ["qq_evidence"],
        createdAt: now,
        updatedAt: now,
      },
    ],
    evidenceEvents: [],
  };
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "lamdan-question-evidence-"));
  let preview;
  let chrome;
  let cdp;
  try {
    preview = spawn(
      npmCommand,
      ["run", "preview", "--", "--host", HOST, "--port", String(APP_PORT)],
      { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
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
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const version = await waitForJson(`http://${HOST}:${DEBUG_PORT}/json/version`, 30_000);
    cdp = await Cdp.connect(version.webSocketDebuggerUrl);
    const { targetId } = await cdp.send("Target.createTarget", { url: `${BASE_URL}/app/dashboard` });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(cdp, sessionId);
    await Promise.all([page.send("Page.enable"), page.send("Runtime.enable")]);
    await page.waitFor("document.readyState === 'complete'");

    await page.evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(fixtureData()))});
      localStorage.setItem("lamdan.concept-evidence.v1", ${JSON.stringify(JSON.stringify(conceptData()))});
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
      return true;
    })()`);

    await page.navigate("/app/quizzes/quiz_evidence");
    await page.waitForText("Which answer should become recognition evidence?");
    await page.clickText("Verified answer");
    await page.waitForText("Верно");
    await page.clickText("Сохранить попытку");
    await page.waitForText("1 снимков ответов");

    await page.waitFor(`(() => {
      const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
      const details = JSON.parse(localStorage.getItem("lamdan.quiz-attempt-details.v1"));
      const concepts = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return core.quizAttempts.length === 1 &&
        details.attempts.length === 1 &&
        details.attempts[0].answers[0].questionPrompt === "Which answer should become recognition evidence?" &&
        details.attempts[0].answers[0].selectedOption === "Verified answer" &&
        concepts.evidenceEvents.some((event) =>
          event.sourceType === "quiz_question_answer" &&
          event.questionId === "qq_evidence" &&
          event.outcome === "success"
        );
    })()`, 20_000);

    await page.reload();
    await page.waitForText("Question Evidence Quiz");
    const persisted = await page.evaluate(`(() => {
      const details = JSON.parse(localStorage.getItem("lamdan.quiz-attempt-details.v1"));
      const concepts = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return {
        attempts: details.attempts.length,
        answer: details.attempts[0]?.answers[0]?.selectedOption,
        recognition: concepts.evidenceEvents.filter((event) => event.sourceType === "quiz_question_answer").length,
      };
    })()`);
    assert(persisted.attempts === 1, "Question snapshots did not survive reload.");
    assert(persisted.answer === "Verified answer", "Selected answer snapshot changed after reload.");
    assert(persisted.recognition === 1, "Recognition evidence duplicated or disappeared after reload.");
    console.log("Question-level quiz evidence browser E2E passed.");
  } finally {
    cdp?.close();
    terminate(chrome);
    terminate(preview);
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
    const result = spawnSync(process.platform === "win32" ? "where" : "which", [name], { encoding: "utf8" });
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

function terminate(handle) {
  if (handle && !handle.killed) handle.kill("SIGTERM");
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
