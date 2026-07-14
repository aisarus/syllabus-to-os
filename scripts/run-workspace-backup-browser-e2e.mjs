import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import JSZip from "jszip";

const HOST = "127.0.0.1";
const APP_PORT = 4175;
const DEBUG_PORT = 9335;
const BASE_URL = `http://${HOST}:${APP_PORT}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const encoder = new TextEncoder();

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.onMessage(event.data));
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((open, reject) => {
      socket.addEventListener("open", open, { once: true });
      socket.addEventListener("error", reject, { once: true });
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

  async waitFor(expression, timeout = 20_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`Boolean(${expression})`)) return;
      } catch {
        // Retry while React/navigation settles.
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

  async setZipFile(filePath) {
    const { root } = await this.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await this.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: 'input[accept*="application/zip"]',
    });
    assert(nodeId, "ZIP file input was not found.");
    await this.send("DOM.setFileInputFiles", { nodeId, files: [resolve(filePath)] });
    await this.evaluate(`(() => {
      const input = document.querySelector('input[accept*="application/zip"]');
      input?.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
  }
}

function coreData(label) {
  const now = 1_700_000_000_000;
  const suffix = label.toLowerCase();
  return {
    version: 1,
    programs: [],
    courses: [
      {
        id: `crs_${suffix}`,
        title: `Course ${label}`,
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
        id: `quiz_${suffix}`,
        title: `Quiz ${label}`,
        courseId: `crs_${suffix}`,
        createdAt: now,
      },
    ],
    quizQuestions: [
      {
        id: `qq_${suffix}`,
        quizId: `quiz_${suffix}`,
        prompt: `Question ${label}`,
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        sourceChunkIds: [`chk_${suffix}`],
      },
    ],
    quizAttempts: [
      {
        id: `att_${suffix}`,
        quizId: `quiz_${suffix}`,
        score: 100,
        correctCount: 1,
        total: 1,
        takenAt: now,
      },
    ],
    assignments: [],
    materials: [
      {
        id: `mat_${suffix}`,
        title: `Source ${label}`,
        type: "lecture",
        sourceMode: "pasted_text",
        courseId: `crs_${suffix}`,
        tags: [],
        rawText: `Evidence ${label}`,
        processingStatus: "ready",
        wordCount: 2,
        charCount: 10,
        extractionMethod: "manual",
        sourceLanguage: "en",
        createdAt: now,
        updatedAt: now,
      },
    ],
    materialChunks: [
      {
        id: `chk_${suffix}`,
        materialId: `mat_${suffix}`,
        order: 0,
        text: `Evidence ${label}`,
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

function conceptData(label) {
  const suffix = label.toLowerCase();
  return {
    version: 1,
    concepts: [
      {
        id: `con_${suffix}`,
        courseId: `crs_${suffix}`,
        title: `Concept ${label}`,
        aliases: [],
        sourceChunkIds: [`chk_${suffix}`],
        flashcardIds: [],
        quizQuestionIds: [`qq_${suffix}`],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    evidenceEvents: [
      {
        id: `cev_${suffix}`,
        conceptId: `con_${suffix}`,
        kind: "recognition",
        outcome: "success",
        sourceType: "quiz_question_answer",
        sourceId: `att_${suffix}`,
        attemptId: `att_${suffix}`,
        questionId: `qq_${suffix}`,
        occurredAt: 1,
      },
    ],
  };
}

function detailData(label) {
  const suffix = label.toLowerCase();
  return {
    version: 1,
    attempts: [
      {
        attemptId: `att_${suffix}`,
        quizId: `quiz_${suffix}`,
        mode: "trainer",
        createdAt: 1,
        answers: [
          {
            questionId: `qq_${suffix}`,
            questionPrompt: `Question ${label}`,
            selectedIndex: 0,
            selectedOption: "A",
            correctIndex: 0,
            correctOption: "A",
            correct: true,
            sourceChunkIds: [`chk_${suffix}`],
          },
        ],
      },
    ],
  };
}

async function createLegacyZip(label) {
  const zip = new JSZip();
  const dataBytes = encoder.encode(JSON.stringify(coreData(label), null, 2));
  zip.file("data.json", dataBytes);
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        format: "lamdan-full-backup",
        version: 1,
        createdAt: new Date(0).toISOString(),
        appDataVersion: 1,
        files: [
          {
            path: "data.json",
            kind: "data",
            size: dataBytes.byteLength,
            sha256: await sha256(dataBytes),
          },
        ],
        materials: [],
      },
      null,
      2,
    ),
  );
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

async function createWorkspaceZip(label, { tamper = false } = {}) {
  const legacyBytes = await createLegacyZip(label);
  const conceptBytes = encoder.encode(JSON.stringify(conceptData(label), null, 2));
  const detailBytes = encoder.encode(JSON.stringify(detailData(label), null, 2));
  const files = [
    { path: "workspace/visual-backup-v1.zip", kind: "visualBackup", bytes: legacyBytes },
    { path: "workspace/concept-evidence.json", kind: "conceptEvidence", bytes: conceptBytes },
    { path: "workspace/quiz-attempt-details.json", kind: "quizAttemptDetails", bytes: detailBytes },
  ];
  const zip = new JSZip();
  for (const file of files) {
    zip.file(
      file.path,
      tamper && file.kind === "conceptEvidence"
        ? encoder.encode('{"version":1,"concepts":[],"evidenceEvents":[]}')
        : file.bytes,
    );
  }
  zip.file(
    "workspace-manifest.json",
    JSON.stringify(
      {
        format: "lamdan-workspace-backup",
        version: 2,
        createdAt: new Date(0).toISOString(),
        legacyVisualFormat: "lamdan-full-backup",
        legacyVisualVersion: 1,
        conceptEvidenceVersion: 1,
        quizAttemptDetailsVersion: 1,
        files: await Promise.all(
          files.map(async (file) => ({
            path: file.path,
            kind: file.kind,
            size: file.bytes.byteLength,
            sha256: await sha256(file.bytes),
          })),
        ),
      },
      null,
      2,
    ),
  );
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "lamdan-workspace-backup-e2e-"));
  const profileDir = join(tempDir, "chrome-profile");
  const validB = join(tempDir, "workspace-b.zip");
  const validC = join(tempDir, "workspace-c.zip");
  const tampered = join(tempDir, "workspace-tampered.zip");
  await Promise.all([
    writeFile(validB, await createWorkspaceZip("B")),
    writeFile(validC, await createWorkspaceZip("C")),
    writeFile(tampered, await createWorkspaceZip("X", { tamper: true })),
  ]);

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
    const { targetId } = await cdp.send("Target.createTarget", { url: `${BASE_URL}/app/dashboard` });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(cdp, sessionId);
    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("DOM.enable"),
    ]);
    await page.waitFor("document.readyState === 'complete'");

    await seedLocalStorage(page, "A");
    await page.navigate("/app/data");
    await page.waitForText("Workspace ZIP v2");

    await page.setZipFile(validB);
    await page.waitForText("Проверенная копия готова");
    await page.evaluate("window.confirm = () => true");
    await page.clickText("Заменить всё");
    await page.waitFor(
      storagePredicate("b"),
      25_000,
    );
    await page.reload();
    await page.waitForText("Course B");
    assert(await page.evaluate(storagePredicate("b")), "Workspace B did not survive reload.");

    const beforeTamper = await readStorage(page);
    await page.setZipFile(tampered);
    await page.waitForText("checksum mismatch");
    assert(
      JSON.stringify(await readStorage(page)) === JSON.stringify(beforeTamper),
      "Tampered archive changed local stores.",
    );

    await page.setZipFile(validC);
    await page.waitForText("Проверенная копия готова");
    await page.evaluate(`(() => {
      window.confirm = () => true;
      const original = Storage.prototype.setItem;
      window.__lamdanOriginalSetItem = original;
      window.__lamdanFailAttemptDetailOnce = true;
      Storage.prototype.setItem = function(key, value) {
        if (key === "lamdan.quiz-attempt-details.v1" && window.__lamdanFailAttemptDetailOnce) {
          window.__lamdanFailAttemptDetailOnce = false;
          throw new DOMException("forced detail failure", "QuotaExceededError");
        }
        return original.call(this, key, value);
      };
      return true;
    })()`);
    await page.clickText("Заменить всё");
    await page.waitForText("Workspace backup import was rolled back");
    await page.evaluate(`(() => {
      if (window.__lamdanOriginalSetItem) Storage.prototype.setItem = window.__lamdanOriginalSetItem;
      return true;
    })()`);
    assert(
      JSON.stringify(await readStorage(page)) === JSON.stringify(beforeTamper),
      "Apply failure did not roll back core, concepts and attempt details.",
    );
    await page.reload();
    assert(await page.evaluate(storagePredicate("b")), "Rolled-back workspace B did not survive reload.");

    console.log("Workspace backup v2 browser restore, tamper and rollback E2E passed.");
  } finally {
    cdp?.close();
    terminateProcessGroup(chrome);
    terminateProcessGroup(preview);
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function seedLocalStorage(page, label) {
  await page.evaluate(`(() => {
    localStorage.clear();
    localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(coreData(label)))});
    localStorage.setItem("lamdan.concept-evidence.v1", ${JSON.stringify(JSON.stringify(conceptData(label)))});
    localStorage.setItem("lamdan.quiz-attempt-details.v1", ${JSON.stringify(JSON.stringify(detailData(label)))});
    localStorage.setItem("lamdan.lang", "ru");
    localStorage.setItem("lamdan.theme", "dark");
    return true;
  })()`);
}

function storagePredicate(suffix) {
  return `(() => {
    const core = JSON.parse(localStorage.getItem("lamdan.data.v1"));
    const concepts = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
    const details = JSON.parse(localStorage.getItem("lamdan.quiz-attempt-details.v1"));
    return core.courses?.[0]?.id === "crs_${suffix}" &&
      concepts.concepts?.[0]?.id === "con_${suffix}" &&
      concepts.evidenceEvents?.[0]?.id === "cev_${suffix}" &&
      details.attempts?.[0]?.attemptId === "att_${suffix}" &&
      details.attempts?.[0]?.answers?.[0]?.questionPrompt === "Question ${suffix.toUpperCase()}";
  })()`;
}

async function readStorage(page) {
  return page.evaluate(`(() => ({
    core: localStorage.getItem("lamdan.data.v1"),
    concepts: localStorage.getItem("lamdan.concept-evidence.v1"),
    details: localStorage.getItem("lamdan.quiz-attempt-details.v1"),
  }))()`);
}

async function sha256(bytes) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
