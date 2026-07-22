import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = 4188;
const DEBUG_PORT = 9348;
const BASE_URL = `http://${HOST}:${APP_PORT}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
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
  on(method, listener) {
    const current = this.listeners.get(method) ?? [];
    current.push(listener);
    this.listeners.set(method, current);
  }
  onMessage(raw) {
    const message = JSON.parse(String(raw));
    if (!message.id) {
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
      return;
    }
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
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    }
    return response.result?.value;
  }
  async waitFor(expression, timeout = 20_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`Boolean(${expression})`)) return;
      } catch {}
      await sleep(120);
    }
    const context = await this.evaluate(`({ url: location.href, title: document.title, text: document.body?.innerText?.slice(0, 1200) ?? "", storageKeys: Object.keys(localStorage) })`).catch(() => null);
    throw new Error(`Timed out waiting for: ${expression}\nPage context: ${JSON.stringify(context)}`);
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
      const target = [...document.querySelectorAll("button")].find((element) =>
        element.getClientRects().length > 0 && !element.disabled &&
        element.textContent?.replace(/\\s+/g, " ").trim().includes(${JSON.stringify(text)})
      );
      if (!target) return false;
      target.click();
      return true;
    })()`);
    assert(clicked, `Could not click: ${text}`);
  }
}

function coreFixture() {
  const now = Date.now();
  return {
    version: 1,
    programs: [],
    courses: [{ id: "crs_loop", title: "Learning Loop", status: "in_progress", order: 0, createdAt: now }],
    topics: [{ id: "top_loop", courseId: "crs_loop", title: "Checks and balances", status: "not_started", order: 0, createdAt: now }],
    notes: [], flashcards: [], quizzes: [], quizQuestions: [], quizAttempts: [], assignments: [],
    materials: [], materialChunks: [], materialOutputs: [], presentationOutlines: [], calendarEvents: [],
    studySessions: [], syllabusImports: [],
  };
}

function evidenceFixture() {
  const now = Date.now();
  return {
    version: 1,
    concepts: [{
      id: "con_loop",
      courseId: "crs_loop",
      topicId: "top_loop",
      title: "Судебный контроль",
      description: "Проверка решений независимыми судами ограничивает исполнительную власть.",
      aliases: [], sourceChunkIds: [], flashcardIds: [], quizQuestionIds: [], createdAt: now, updatedAt: now,
    }],
    evidenceEvents: [],
  };
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "lamdan-topic-loop-"));
  let preview;
  let chrome;
  let cdp;
  const browserErrors = [];
  const failedRequests = [];
  try {
    preview = spawn(npmCommand, ["run", "preview", "--", "--host", HOST, "--port", String(APP_PORT)], {
      cwd: process.cwd(), env: process.env, stdio: "ignore", detached: process.platform !== "win32",
    });
    await waitForHttp(`${BASE_URL}/app/dashboard`, 30_000);
    chrome = spawn(findChrome(), [
      "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
      `--remote-debugging-address=${HOST}`, `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profileDir}`, "about:blank",
    ], { stdio: "ignore", detached: process.platform !== "win32" });
    const version = await waitForJson(`http://${HOST}:${DEBUG_PORT}/json/version`, 30_000);
    cdp = await Cdp.connect(version.webSocketDebuggerUrl);
    cdp.on("Runtime.exceptionThrown", (params) => {
      browserErrors.push(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? "Runtime exception");
    });
    cdp.on("Log.entryAdded", (params) => {
      if (params.entry?.level === "error") browserErrors.push(params.entry.text ?? "Browser log error");
    });
    cdp.on("Network.loadingFailed", (params) => {
      if (!params.canceled) failedRequests.push(`${params.errorText ?? "request failed"}:${params.requestId ?? "unknown"}`);
    });

    const { targetId } = await cdp.send("Target.createTarget", { url: `${BASE_URL}/app/dashboard` });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(cdp, sessionId);
    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("Log.enable"),
      page.send("Network.enable"),
    ]);
    await page.navigate("/app/dashboard");

    await page.evaluate(`(() => {
      localStorage.clear();
      localStorage.setItem("lamdan.data.v1", ${JSON.stringify(JSON.stringify(coreFixture()))});
      localStorage.setItem("lamdan.concept-evidence.v1", ${JSON.stringify(JSON.stringify(evidenceFixture()))});
      localStorage.setItem("lamdan.quiz-attempt-details.v1", JSON.stringify({ version: 1, attempts: [] }));
      localStorage.setItem("lamdan.lang", "ru");
      localStorage.setItem("lamdan.theme", "dark");
    })()`);
    await page.reload();

    await page.navigate("/app/courses/crs_loop");
    await page.waitForText("Короткая проверка темы");
    await page.waitForText("Проверка решений независимыми судами");
    await page.evaluate(`(() => {
      const textarea = [...document.querySelectorAll("textarea")].find((item) => item.placeholder?.includes("Напиши ответ"));
      if (!textarea) throw new Error("Recall textarea not found");
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(textarea, "Судебный контроль — проверка решений независимыми судами.");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
    await page.clickText("Проверить ответ");
    await page.waitFor(`document.querySelector('[data-topic-recall-result="passed"]')`);
    await page.waitFor(`document.querySelector('[data-topic-recall-match-breakdown]')?.textContent?.includes('Совпало точно:') && document.querySelector('[data-topic-recall-match-breakdown]')?.textContent?.includes('По словоформе:')`);
    await page.clickText("Проверить ответ");
    await sleep(100);

    const beforeReload = await page.evaluate(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      const events = data.evidenceEvents.filter((event) => event.sourceLabel === "Deterministic topic recall");
      return { count: events.length, outcome: events[0]?.outcome, score: events[0]?.score, sourceId: events[0]?.sourceId, sourceType: events[0]?.sourceType };
    })()`);
    assert(beforeReload.count === 1, "Repeated verification of the same response must remain one evidence event");
    assert(beforeReload.outcome === "success", "Verified recall must persist success");
    assert(beforeReload.score >= 50, "Verified recall must persist deterministic score");
    assert(beforeReload.sourceId?.startsWith("topic-recall:con_loop:"), "Verified recall must persist a stable attempt key");
    assert(beforeReload.sourceType === "deterministic_recall", "Verified recall must persist the dedicated source type");

    await page.reload();
    await page.waitFor(`document.querySelector('[data-persisted-topic-progress="success"]')`);
    await page.waitForText("Подтверждённый прогресс");
    const afterReload = await page.evaluate(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return data.evidenceEvents.filter((event) => event.sourceLabel === "Deterministic topic recall").length;
    })()`);
    assert(afterReload === 1, "Reload must not duplicate the verified attempt");

    await page.evaluate(`localStorage.setItem("lamdan.lang", "en")`);
    await page.reload();
    await page.waitForText("Topic learning check");
    await page.evaluate(`(() => {
      const textarea = [...document.querySelectorAll("textarea")].find((item) => item.placeholder?.includes("Answer without looking back"));
      if (!textarea) throw new Error("English recall textarea not found");
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(textarea, "Судебный контроль — проверка решений независимыми судами.");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
    await page.clickText("Verify answer");
    await page.waitFor(`document.querySelector('[data-topic-recall-match-breakdown]')?.textContent?.includes('Exact matches:') && document.querySelector('[data-topic-recall-match-breakdown]')?.textContent?.includes('Normalized forms:')`);
    const afterEnglishVerify = await page.evaluate(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return data.evidenceEvents.filter((event) => event.sourceLabel === "Deterministic topic recall").length;
    })()`);
    assert(afterEnglishVerify === 1, "English verification of the same response must not duplicate evidence");

    await page.reload();
    await page.waitFor(`document.querySelector('[data-persisted-topic-progress="success"]')`);
    await page.waitForText("Verified progress");
    const afterEnglishReload = await page.evaluate(`(() => {
      const data = JSON.parse(localStorage.getItem("lamdan.concept-evidence.v1"));
      return data.evidenceEvents.filter((event) => event.sourceLabel === "Deterministic topic recall").length;
    })()`);
    assert(afterEnglishReload === 1, "English reload must preserve one verified attempt without duplication");

    assert(browserErrors.length === 0, `Browser errors detected: ${browserErrors.join(" | ")}`);
    assert(failedRequests.length === 0, `Failed network requests detected: ${failedRequests.join(" | ")}`);
    console.log("Topic learning slice browser E2E passed with RU/EN match breakdown, reload persistence, idempotent evidence and clean browser diagnostics.");
  } finally {
    cdp?.close();
    terminate(chrome);
    terminate(preview);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

function findChrome() {
  const candidates = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
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
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await sleep(150);
  }
  throw new Error(`Preview did not start at ${url}`);
}
async function waitForJson(url, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try { const response = await fetch(url); if (response.ok) return response.json(); } catch {}
    await sleep(150);
  }
  throw new Error(`Chrome debugger did not start at ${url}`);
}
function terminate(handle) {
  if (!handle || handle.killed) return;
  if (process.platform !== "win32" && handle.pid) {
    try { process.kill(-handle.pid, "SIGTERM"); return; } catch {}
  }
  handle.kill("SIGTERM");
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

await main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});