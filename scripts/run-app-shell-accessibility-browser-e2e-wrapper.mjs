const timeoutMilliseconds = Number(process.env.LAM_DAN_APP_SHELL_E2E_TIMEOUT_MS ?? 120_000);
const timeout = setTimeout(() => {
  console.error(`AppShell browser E2E exceeded ${timeoutMilliseconds} ms and was terminated.`);
  process.exit(124);
}, timeoutMilliseconds);

timeout.unref?.();

try {
  await import("./run-app-shell-accessibility-browser-e2e.mjs");
  clearTimeout(timeout);
  process.exit(process.exitCode ?? 0);
} catch (error) {
  clearTimeout(timeout);
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
}
