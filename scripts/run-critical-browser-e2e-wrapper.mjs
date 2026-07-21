const timeoutMilliseconds = Number(process.env.LAM_DAN_E2E_TIMEOUT_MS ?? 540_000);
const timeout = setTimeout(() => {
  console.error(`Critical browser E2E exceeded ${timeoutMilliseconds} ms and was terminated.`);
  process.exit(124);
}, timeoutMilliseconds);

try {
  await import("./run-app-shell-accessibility-browser-e2e.mjs");
  await import("./run-critical-browser-e2e.mjs");
  await import("./run-source-reference-deletion-browser-e2e.mjs");
  await import("./run-multipage-replacement-browser-e2e.mjs");
  await import("./run-study-pack-continuation-browser-e2e.mjs");
  await import("./run-quiz-repair-browser-e2e.mjs");
  clearTimeout(timeout);
  process.exit(process.exitCode ?? 0);
} catch (error) {
  clearTimeout(timeout);
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
}
