import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4174;
const DEBUG_PORT = 9334;
const BASE_URL = `http://${HOST}:${APP_PORT}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const artifactDir = resolve(
  process.cwd(),
  process.env.LAM_DAN_SOURCE_REFERENCE_E2E_ARTIFACT_DIR ||
    "critical-e2e-artifacts/source-reference-deletion",
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
    this.listeners.set(key, [...(this.listeners.get(key) ?? []), listener]);
  }

  onMessage(raw) {
    const message = JSON.parse(String(raw));
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
      return;
    }
    const key = `${message.sessionId ?? "browser"}:${message.method}`;
    for (const listener of this.listeners.get(key) ?? []) listener(message.params ?? {});
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
  }
}

class BrowserPage {
  constructor(cdp, contextId, sessionId) {
    this.cdp = cdp;
    this.contextId = contextId;
    this.sessionId = sessionId;
    this.consoleMessages = [];
  }

  static async create(cdp) {
    const { browserContextId } = await cdp.send("Target.createBrowserContext");
    const { targetId } = await cdp.send("Target.createTarget", {
      url: `${BASE_URL}/app/dashboard`,
      browserContextId,
    });
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const page = new BrowserPage(cdp, browserContextId, sessionId);
    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("DOM.enable"),
    ]);
    cdp.on("Runtime.consoleAPICalled", sessionId, (event) => {
      const values = (event.args ?? []).map(
        (argument) => argument.value ?? argument.description ?? "",
      );
      page.consoleMessages.push(`[console.${event.type}] ${values.join(" ")}`);
    });
    cdp.on("Runtime.exceptionThrown", sessionId, (event) => {
      page.consoleMessages.push(
        `[exception] ${event.exceptionDetails?.exception?.description ?? event.exceptionDetails?.text ?? "unknown"}`,
      );
    });
    cdp.on("Page.javascriptDialogOpening", sessionId, () => {
      void page.send("Page.handleJavaScriptDialog", { accept: true });
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
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          "Evaluation failed",
      );
    }
    return result.result?.value;
  }

  async waitFor(expression, timeout = 20_000) {
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
      `Timed out waiting for ${expression}${lastError ? `: ${readableError(lastError)}` : ""}`,
    );
  }

  waitForText(text, timeout = 20_000) {
    return this.waitFor(`document.body?.innerText.includes(${JSON.stringify(text)})`, timeout);
  }

  async navigate(path) {
    await this.send("Page.navigate", { url: `${BASE_URL}${path}` });
    await this.waitFor("document.readyState === 'complete'");
    await this.waitFor("Boolean(document.body)");
  }

  async reload() {
    await this.send("Page.reload", { ignoreCache: true });
    await this.waitFor("document.readyState === 'complete'");
  }

  async clickAria(label) {
    const clicked = await this.evaluate(`(() => {
      const target = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});
      if (!target || target.getClientRects().length === 0) return false;
      target.click();
      return true;
    })()`);
    assert(clicked, `Could not click aria-label ${label}.`);
  }

  async clickExactButton(text) {
    const clicked = await this.evaluate(`(() => {
      const target = [...document.querySelectorAll("button")].find((button) =>
        button.getClientRects().length > 0 &&
        !button.disabled &&
        button.textContent?.replace(/\\s+/g, " ").trim() === ${JSON.stringify(text)}
      );
      if (!target) return false;
      target.click();
      return true;
    })()`);
    assert(clicked, `Could not click exact button ${text}.`);
  }

  async captureDiagnostics() {
    const [url, body, screenshot] = await Promise.all([
      this.evaluate("location.href").catch(() => "unknown"),
      this.evaluate("document.body?.innerText ?? ''").catch(() => ""),
      this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }).catch(
        () => null,
      ),
    ]);
    await Promise.all([
      writeFile(join(artifactDir, "failure.txt"), `URL: ${url}\n\n${body}\n`),
      writeFile(join(artifactDir, "console.txt"), `${this.consoleMessages.join("\n")}\n`),
      screenshot?.data
        ? writeFile(join(artifactDir, "failure.png"), Buffer.from(screenshot.data, "base64"))
        : Promise.resolve(),
    ]);
  }

  close() {
    return this.cdp.send("Target.disposeBrowserContext", {
      browserContextId: this.contextId,
    });
  }
}

function fixture() {
  const now = Date.now();
  const materialId = "mat_reference";
  const chunkIds = ["chunk_drop", "chunk_keep"];
  return {
    version: 1,
    programs: [],
    courses: [],
    topics: [],
    assignments: [],
    materialOutputs: [],
    calendarEvents: [],
    studySessions: [],
    syllabusImports: [],
    quizAttempts: [],
    materials: [
      {
        id: materialId,
        title: "Reference deletion material",
        type: "lecture",
        sourceMode: "pasted_text",
        tags: [],
        rawText: "Delete this chunk\n\nKeep this chunk",
        processingStatus: "ready",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: chunkIds[0],
        materialId,
        order: 0,
        title: "Delete",
        text: "Delete this chunk",
        pageNumber: 1,
        section: "delete",
        createdAt: now,
      },
      {
        id: chunkIds[1],
        materialId,
        order: 1,
        title: "Keep",
        text: "Keep this chunk",
        pageNumber: 2,
        section: "keep",
        createdAt: now + 1,
      },
    ],
    notes: [
      {
        id: "note_reference",
        title: "Reference note",
        content: "Linked note",
        tags: [],
        materialId,
        sourceChunkIds: chunkIds,
        createdAt: now,
        updatedAt: now,
      },
    ],
    flashcards: [
      {
        id: "card_reference",
        front: "Reference?",
        back: "Reference",
        materialId,
        sourceChunkIds: chunkIds,
        status: "new",
        dueAt: now,
        interval: 0,
        createdAt: now,
      },
    ],
    quizzes: [
      {
        id: "quiz_reference",
        title: "Reference quiz",
        materialId,
        createdAt: now,
      },
    ],
    quizQuestions: [
      {
        id: "question_reference",
        quizId: "quiz_reference",
        prompt: "Reference?",
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        sourceChunkIds: chunkIds,
      },
    ],
    presentationOutlines: [
      {
        id: "outline_reference",
        title: "Reference outline",
        materialId,
        slides: [
          {
            id: "slide_reference",
            title: "Reference slide",
            bullets: [],
            sourceChunkIds: chunkIds,
            order: 0,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

async function runFlow(page) {
  const seeded = fixture();
  await page.evaluate(`(() => {
    localStorage.clear();
    localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(fixture()))});
    localStorage.setItem("lamdan.lang", "ru");
    localStorage.setItem("lamdan.theme", "dark");
    return true;
  })()`);
  await page.navigate("/app/materials/mat_reference");
  await page.waitForText("Reference deletion material");
  await page.clickAria("Удалить фрагмент");
  await page.waitFor(
    `!JSON.parse(localStorage.getItem("lamdan.data.v1")).materialChunks.some((chunk) => chunk.id === "chunk_drop")`,
  );

  const afterChunkDelete = await page.evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem("lamdan.data.v1"));
    return [
      data.notes[0].sourceChunkIds,
      data.flashcards[0].sourceChunkIds,
      data.quizQuestions[0].sourceChunkIds,
      data.presentationOutlines[0].slides[0].sourceChunkIds,
    ];
  })()`);
  for (const ids of afterChunkDelete) {
    assert(!ids.includes("chunk_drop"), "Deleted chunk remained in a source reference.");
    assert(ids.includes("chunk_keep"), "Deleting one chunk removed an unrelated citation.");
  }

  await page.reload();
  await page.waitForText("Reference deletion material");
  await page.clickExactButton("Удалить");
  await page.waitFor(`location.pathname === "/app/materials"`);
  await page.waitFor(
    `!JSON.parse(localStorage.getItem("lamdan.data.v1")).materials.some((item) => item.id === "mat_reference")`,
  );
  await page.reload();

  const finalState = await page.evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem("lamdan.data.v1"));
    return {
      materialCount: data.materials.filter((item) => item.id === "mat_reference").length,
      chunkCount: data.materialChunks.filter((chunk) => chunk.materialId === "mat_reference").length,
      references: [
        ...data.notes.flatMap((item) => item.sourceChunkIds ?? []),
        ...data.flashcards.flatMap((item) => item.sourceChunkIds ?? []),
        ...data.quizQuestions.flatMap((item) => item.sourceChunkIds ?? []),
        ...data.presentationOutlines.flatMap((outline) =>
          outline.slides.flatMap((slide) => slide.sourceChunkIds ?? []),
        ),
      ],
      linkedMaterialIds: [
        data.notes[0].materialId,
        data.flashcards[0].materialId,
        data.quizzes[0].materialId,
        data.presentationOutlines[0].materialId,
      ].filter(Boolean),
    };
  })()`);
  assert(finalState.materialCount === 0, "Deleted material returned after reload.");
  assert(finalState.chunkCount === 0, "Deleted material left chunks after reload.");
  assert(finalState.references.length === 0, "Deleted material left dangling citations.");
  assert(finalState.linkedMaterialIds.length === 0, "Deleted material left material links.");
  assert(seeded.materials.length === 1, "Fixture was not created correctly.");
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
  const command = process.platform === "win32" ? "where" : "which";
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync(command, [name], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error("Chromium/Chrome was not found.");
}

async function waitForHttp(url, timeout, logs) {
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
  throw new Error(`Preview did not start at ${url}.\n${logs()}`);
}

async function waitForJson(url, timeout, logs) {
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
  throw new Error(`Chrome debugger did not start at ${url}.\n${logs()}`);
}

function collectLogs(processHandle, label) {
  let buffer = "";
  const append = (chunk) => {
    buffer += `[${label}] ${String(chunk)}`;
    if (buffer.length > 30_000) buffer = buffer.slice(-30_000);
  };
  processHandle.stdout?.on("data", append);
  processHandle.stderr?.on("data", append);
  return () => buffer;
}

function terminate(processHandle) {
  if (processHandle && !processHandle.killed) processHandle.kill("SIGTERM");
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
  const profileDir = join(tmpdir(), `lamdan-source-reference-${Date.now()}`);
  await mkdir(profileDir, { recursive: true });

  let preview;
  let chrome;
  let cdp;
  let page;
  let previewLogs = () => "";
  let chromeLogs = () => "";
  try {
    preview = spawn(
      npmCommand,
      ["run", "preview", "--", "--host", HOST, "--port", String(APP_PORT)],
      { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    previewLogs = collectLogs(preview, "preview");
    await waitForHttp(`${BASE_URL}/app/dashboard`, 30_000, previewLogs);

    chrome = spawn(
      findChrome(),
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
      chromeLogs,
    );
    cdp = await CdpClient.connect(version.webSocketDebuggerUrl);
    page = await BrowserPage.create(cdp);
    await runFlow(page);
    console.log("✓ source-reference deletion and reload integrity");
  } catch (error) {
    await page?.captureDiagnostics().catch(() => {});
    await Promise.all([
      writeFile(join(artifactDir, "preview.log"), previewLogs()),
      writeFile(join(artifactDir, "chrome.log"), chromeLogs()),
    ]);
    throw error;
  } finally {
    await page?.close().catch(() => {});
    cdp?.close();
    terminate(chrome);
    terminate(preview);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main().catch((error) => {
  console.error(`Source-reference browser E2E failed: ${readableError(error)}`);
  process.exitCode = 1;
});
