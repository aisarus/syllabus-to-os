import { readFile } from "node:fs/promises";

const sourceUrl = new URL("./run-local-range-extraction-browser-e2e.mjs", import.meta.url);
let source = await readFile(sourceUrl, "utf8");

function replaceRequired(marker, replacement, label, count = 1) {
  if (!source.includes(marker)) {
    throw new Error(`Could not instrument local range browser harness: ${label}.`);
  }
  if (count === 1) {
    source = source.replace(marker, replacement);
    return;
  }
  let remaining = count;
  source = source.replaceAll(marker, (match) => {
    if (remaining <= 0) return match;
    remaining -= 1;
    return replacement;
  });
}

replaceRequired(
  `    return new Promise((resolveMessage, rejectMessage) => {
      this.pending.set(id, { resolve: resolveMessage, reject: rejectMessage });
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });`,
  `    return new Promise((resolveMessage, rejectMessage) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectMessage(new Error(\`CDP \${method} timed out after 20 seconds.\`));
      }, 20_000);
      this.pending.set(id, { resolve: resolveMessage, reject: rejectMessage, timer });
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });`,
  "CDP request timeout",
);

replaceRequired(
  `    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message));`,
  `    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(message.error.message));`,
  "CDP response timeout cleanup",
);

replaceRequired(
  `      target.click();
      return true;`,
  `      setTimeout(() => target.click(), 0);
      return true;`,
  "deferred click dispatch",
);

replaceRequired(
  `    throw new Error(\`Timed out waiting for: \${expression}\`);`,
  `    let diagnostics;
    try {
      diagnostics = await this.evaluate(\`(() => ({
        url: location.href,
        body: document.body?.innerText?.slice(-5000) ?? "",
        serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
        core: localStorage.getItem("lamdan.data.v1"),
      }))()\`);
    } catch (diagnosticError) {
      diagnostics = { diagnosticError: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError) };
    }
    throw new Error(\`Timed out waiting for: \${expression}\\nDiagnostics: \${JSON.stringify(diagnostics)}\`);`,
  "wait timeout diagnostics",
);

replaceRequired(
  `    await page.waitFor(
      \`(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("lamdan-range-extraction", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const clip = await new Promise((resolve, reject) => {
        const request = db.transaction("clips", "readonly").objectStore("clips").get(["mat_extract", "range_extract"]);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return clip?.blob?.size > 0 && clip?.sourceUploadId === "upload_extract";
    })()\`,
      60_000,
    );`,
  `    await page.waitForText("Извлечь заново", 60_000);`,
  "stable persisted clip UI wait",
);

const stages = [
  [
    `    preview = spawn(`,
    `    console.log("[local-range] starting preview");
    preview = spawn(`,
    "preview start",
  ],
  [
    `    await waitForHttp(\`${"${BASE_URL}"}/app/dashboard\`, 30_000);`,
    `    await waitForHttp(\`${"${BASE_URL}"}/app/dashboard\`, 30_000);
    console.log("[local-range] preview ready");`,
    "preview ready",
  ],
  [
    `    const version = await waitForJson(\`http://${"${HOST}"}:${"${DEBUG_PORT}"}/json/version\`, 30_000);`,
    `    const version = await waitForJson(\`http://${"${HOST}"}:${"${DEBUG_PORT}"}/json/version\`, 30_000);
    console.log("[local-range] chrome debugger ready");`,
    "chrome debugger",
  ],
  [
    `    await page.evaluate(\`(async () => {`,
    `    console.log("[local-range] seeding fixture");
    await page.evaluate(\`(async () => {`,
    "fixture seed start",
  ],
  [
    `    await page.navigate("/app/materials/mat_extract");`,
    `    console.log("[local-range] fixture seeded");
    await page.navigate("/app/materials/mat_extract");`,
    "fixture seeded",
  ],
  [
    `    await page.waitForText("Локально извлечь clips из оригинала");`,
    `    await page.waitForText("Локально извлечь clips из оригинала");
    console.log("[local-range] extraction panel ready");`,
    "panel ready",
  ],
  [
    `    await page.clickText("Извлечь локально");`,
    `    await page.evaluate("window.confirm = () => true");
    await page.clickText("Извлечь локально");
    console.log("[local-range] extraction clicked");`,
    "extraction click",
  ],
  [
    `    const rangeResponse = await page.evaluate(\`(async () => {`,
    `    console.log("[local-range] clip persisted");
    const rangeResponse = await page.evaluate(\`(async () => {`,
    "clip persisted",
  ],
  [
    `    await page.checkLabel("Я вижу провайдера");`,
    `    console.log("[local-range] HTTP range verified");
    const consentChanged = await page.evaluate(\`(() => {
      const panel = [...document.querySelectorAll("section")].find((section) =>
        section.textContent?.includes("Локально извлечь clips из оригинала") &&
        section.textContent?.includes("Отправить извлечённые clips")
      );
      const input = panel?.querySelector('label input[type="checkbox"]');
      if (!(input instanceof HTMLInputElement)) return false;
      if (!input.checked) input.click();
      return true;
    })()\`);
    assert(consentChanged, "Could not select local clip provider consent.");
    await page.waitFor(\`(() => {
      const panel = [...document.querySelectorAll("section")].find((section) =>
        section.textContent?.includes("Локально извлечь clips из оригинала") &&
        section.textContent?.includes("Отправить извлечённые clips")
      );
      return [...(panel?.querySelectorAll("button") ?? [])].some((button) =>
        !button.disabled && button.textContent?.includes("Отправить извлечённые clips")
      );
    })()\`);
    console.log("[local-range] provider action enabled");`,
    "provider consent",
  ],
  [
    `    await page.clickText("Отправить извлечённые clips");`,
    `    await page.clickText("Отправить извлечённые clips");
    console.log("[local-range] provider send clicked");`,
    "provider send",
  ],
  [
    `    await page.clickText("Загрузить merged draft");`,
    `    console.log("[local-range] provider result ready");
    await page.clickText("Загрузить merged draft");`,
    "draft load click",
  ],
  [
    `    const beforeReload = await inspectProof(page);`,
    `    console.log("[local-range] draft loaded");
    const beforeReload = await inspectProof(page);`,
    "draft loaded",
  ],
  [
    `    await page.reload();`,
    `    console.log("[local-range] reloading");
    await page.reload();`,
    "reload",
  ],
];

for (const [marker, replacement, label] of stages) {
  replaceRequired(marker, replacement, label);
}

console.log("[local-range] bounded browser harness loaded");
const encoded = Buffer.from(source, "utf8").toString("base64");
await import(`data:text/javascript;base64,${encoded}`);
