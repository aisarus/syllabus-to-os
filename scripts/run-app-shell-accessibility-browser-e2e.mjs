import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const APP_PORT = Number(process.env.LAM_DAN_APP_SHELL_E2E_PORT ?? 4174);
const DEBUG_PORT = Number(process.env.LAM_DAN_APP_SHELL_E2E_DEBUG_PORT ?? 9334);
const BASE_URL = `http://${HOST}:${APP_PORT}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const artifactDir = resolve(
  process.cwd(),
  process.env.LAM_DAN_APP_SHELL_E2E_ARTIFACT_DIR ?? "app-shell-e2e-artifacts",
);

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.onMessage(event.data));
  }

  static async connect(url) {
    if (typeof WebSocket !== "function") {
      throw new Error("Node 22+ with the global WebSocket API is required.");
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

  onMessage(raw) {
    const message = JSON.parse(String(raw));
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(`${message.error.message} (${message.error.code})`));
    } else {
      pending.resolve(message.result ?? {});
    }
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
  }
}

class BrowserPage {
  constructor(cdp, contextId, targetId, sessionId) {
    this.cdp = cdp;
    this.contextId = contextId;
    this.targetId = targetId;
    this.sessionId = sessionId;
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
    const page = new BrowserPage(cdp, browserContextId, targetId, sessionId);
    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("DOM.enable"),
      page.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      }),
    ]);
    await page.waitFor("document.readyState === 'complete'");
    await page.waitFor("Boolean(document.querySelector('.content-mobile-header'))");
    return page;
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
          "Browser evaluation failed.",
      );
    }
    return response.result?.value;
  }

  async waitFor(expression, timeout = 15_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await this.evaluate(`Boolean(${expression})`).catch(() => false)) return;
      await sleep(100);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }

  async key(key, modifiers = 0) {
    const keyCode = key === "Tab" ? 9 : key === "Enter" ? 13 : key === "Escape" ? 27 : 0;
    await this.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code: key,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      modifiers,
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code: key,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      modifiers,
    });
  }

  async close() {
    await this.cdp.send("Target.closeTarget", { targetId: this.targetId }).catch(() => {});
    await this.cdp
      .send("Target.disposeBrowserContext", { browserContextId: this.contextId })
      .catch(() => {});
  }
}

async function runFlow(page) {
  await page.evaluate(`(() => {
    localStorage.setItem("lamdan.lang", "ru");
    document.body.focus();
    return true;
  })()`);

  await page.key("Tab");
  assert(
    await page.evaluate("document.activeElement?.classList.contains('content-skip-link')"),
    "The first Tab stop is not the skip link.",
  );

  await page.key("Enter");
  await page.waitFor("document.activeElement?.id === 'lamdan-main-content'");

  const menuLabel = "Открыть навигацию";
  assert(
    await page.evaluate(`(() => {
      const button = document.querySelector('[aria-label="${menuLabel}"]');
      if (!button || button.getClientRects().length === 0) return false;
      button.focus();
      return document.activeElement === button;
    })()`),
    "The mobile navigation button is not visible or focusable.",
  );

  await page.key("Enter");
  await page.waitFor("Boolean(document.querySelector('#lamdan-mobile-navigation'))");
  await page.waitFor("document.activeElement?.getAttribute('aria-label') === 'Закрыть меню'");

  const focusState = await page.evaluate(`(() => {
    const drawer = document.querySelector('#lamdan-mobile-navigation');
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const controls = [...drawer.querySelectorAll(selector)].filter((element) =>
      element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true'
    );
    return {
      count: controls.length,
      firstLabel: controls[0]?.getAttribute('aria-label') ?? controls[0]?.textContent?.trim(),
      lastLabel: controls.at(-1)?.getAttribute('aria-label') ?? controls.at(-1)?.textContent?.trim(),
    };
  })()`);
  assert(focusState.count > 1, "The mobile drawer does not expose enough focusable controls.");

  await page.key("Tab", 8);
  assert(
    await page.evaluate(`(() => {
      const drawer = document.querySelector('#lamdan-mobile-navigation');
      const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const controls = [...drawer.querySelectorAll(selector)].filter((element) =>
        element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true'
      );
      return document.activeElement === controls.at(-1);
    })()`),
    "Shift+Tab did not wrap focus from the first drawer control to the last.",
  );

  await page.key("Tab");
  assert(
    await page.evaluate(`(() => {
      const drawer = document.querySelector('#lamdan-mobile-navigation');
      const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const controls = [...drawer.querySelectorAll(selector)].filter((element) =>
        element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true'
      );
      return document.activeElement === controls[0];
    })()`),
    "Tab did not wrap focus from the last drawer control to the first.",
  );

  await page.key("Escape");
  await page.waitFor("!document.querySelector('#lamdan-mobile-navigation')");
  await page.waitFor(`document.activeElement?.getAttribute('aria-label') === '${menuLabel}'`);

  console.log(
    `AppShell browser E2E passed: skip link, initial drawer focus, ${focusState.count} trapped controls, Escape and focus restoration.`,
  );
}

async function main() {
  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });
  const workDir = await mkdtemp(join(tmpdir(), "lamdan-app-shell-e2e-"));
  const profileDir = join(workDir, "chrome-profile");
  await mkdir(profileDir, { recursive: true });

  let preview;
  let chrome;
  let cdp;
  let page;
  let previewLogs = "";
  let chromeLogs = "";
  try {
    preview = spawn(
      npmCommand,
      ["run", "preview", "--", "--host", HOST, "--port", String(APP_PORT)],
      { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    preview.stdout?.on("data", (chunk) => (previewLogs += String(chunk)));
    preview.stderr?.on("data", (chunk) => (previewLogs += String(chunk)));
    await waitForHttp(`${BASE_URL}/app/dashboard`, 30_000, () => previewLogs);

    const chromePath = findChrome();
    chrome = spawn(
      chromePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-extensions",
        "--no-first-run",
        `--remote-debugging-address=${HOST}`,
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${profileDir}`,
        "about:blank",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    chrome.stdout?.on("data", (chunk) => (chromeLogs += String(chunk)));
    chrome.stderr?.on("data", (chunk) => (chromeLogs += String(chunk)));
    const version = await waitForJson(
      `http://${HOST}:${DEBUG_PORT}/json/version`,
      30_000,
      () => chromeLogs,
    );
    cdp = await CdpClient.connect(version.webSocketDebuggerUrl);
    page = await BrowserPage.create(cdp);
    await runFlow(page);
  } catch (error) {
    await Promise.all([
      writeFile(join(artifactDir, "preview.log"), previewLogs),
      writeFile(join(artifactDir, "chrome.log"), chromeLogs),
      writeFile(join(artifactDir, "failure.txt"), `${readableError(error)}\n`),
    ]);
    throw error;
  } finally {
    await page?.close().catch(() => {});
    cdp?.close();
    terminate(chrome);
    terminate(preview);
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function findChrome() {
  const candidates = [
    process.env.LAM_DAN_CHROME_PATH,
    process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : undefined,
    process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : undefined,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  const command = process.platform === "win32" ? "where" : "which";
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync(command, [name], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim().split(/\r?\n/u)[0];
  }
  throw new Error("Chromium/Chrome was not found. Set LAM_DAN_CHROME_PATH.");
}

async function waitForHttp(url, timeout, logs) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until the preview is ready.
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
      // Retry until the debugger is ready.
    }
    await sleep(150);
  }
  throw new Error(`Chrome DevTools did not start at ${url}.\n${logs()}`);
}

function terminate(processHandle) {
  if (processHandle && !processHandle.killed) processHandle.kill("SIGTERM");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readableError(error) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

await main().catch((error) => {
  console.error(`AppShell browser E2E failed:\n${readableError(error)}`);
  process.exitCode = 1;
});
