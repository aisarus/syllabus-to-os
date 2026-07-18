import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

export class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.onMessage(event.data));
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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

export class BrowserProofPage {
  constructor(cdp, contextId, sessionId, baseUrl) {
    this.cdp = cdp;
    this.contextId = contextId;
    this.sessionId = sessionId;
    this.baseUrl = baseUrl;
  }

  static async create(cdp, baseUrl) {
    const { browserContextId } = await cdp.send("Target.createBrowserContext");
    const { targetId } = await cdp.send("Target.createTarget", {
      url: `${baseUrl}/app/dashboard`,
      browserContextId,
    });
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const page = new BrowserProofPage(cdp, browserContextId, sessionId, baseUrl);
    await Promise.all([page.send("Page.enable"), page.send("Runtime.enable"), page.send("DOM.enable")]);
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

  async waitFor(expression, timeout = 25_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`Boolean(${expression})`)) return;
      } catch {
        // The page may still be navigating.
      }
      await sleep(100);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  }

  waitForText(text) {
    return this.waitFor(`document.body?.innerText.includes(${JSON.stringify(text)})`);
  }

  async navigate(path) {
    await this.send("Page.navigate", { url: `${this.baseUrl}${path}` });
    await this.waitFor("document.readyState === 'complete'");
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
    assert(clicked, `Could not click ${label}.`);
  }

  async setFileInput(selector, filePath) {
    const { root } = await this.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await this.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    assert(nodeId, `File input not found: ${selector}`);
    await this.send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
  }

  close() {
    return this.cdp.send("Target.disposeBrowserContext", { browserContextId: this.contextId });
  }
}

export async function runBrowserProof({ name, appPort, debugPort, execute }) {
  const host = "127.0.0.1";
  const baseUrl = `http://${host}:${appPort}`;
  const profileDir = join(tmpdir(), `lamdan-${name}-${Date.now()}`);
  await mkdir(profileDir, { recursive: true });
  let preview;
  let chrome;
  let cdp;
  let page;
  try {
    preview = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "preview", "--", "--host", host, "--port", String(appPort)],
      { cwd: process.cwd(), env: process.env, stdio: "ignore" },
    );
    await waitForHttp(`${baseUrl}/app/dashboard`, 30_000);
    chrome = spawn(
      findChrome(),
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-extensions",
        "--no-first-run",
        `--remote-debugging-address=${host}`,
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${profileDir}`,
        "about:blank",
      ],
      { stdio: "ignore" },
    );
    const version = await waitForJson(`http://${host}:${debugPort}/json/version`, 30_000);
    cdp = await CdpClient.connect(version.webSocketDebuggerUrl);
    page = await BrowserProofPage.create(cdp, baseUrl);
    await execute({ page, profileDir });
  } finally {
    await page?.close().catch(() => {});
    cdp?.close();
    if (chrome && !chrome.killed) chrome.kill("SIGTERM");
    if (preview && !preview.killed) preview.kill("SIGTERM");
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function writeTinyPng(path) {
  await writeFile(
    path,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2l7sAAAAASUVORK5CYII=",
      "base64",
    ),
  );
}

function findChrome() {
  const candidates = [
    process.env.LAM_DAN_CHROME_PATH,
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
  ].filter(Boolean);
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  const command = process.platform === "win32" ? "where" : "which";
  for (const name of ["google-chrome", "google-chrome-stable", "chromium"]) {
    const result = spawnSync(command, [name], { encoding: "utf8" });
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

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
