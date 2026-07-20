import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const files = {
  types: await readFile(resolve(root, "src/lib/server/ai-execution-types.ts"), "utf8"),
  runtime: await readFile(resolve(root, "src/lib/server/ai-execution-runtime.ts"), "utf8"),
  http: await readFile(resolve(root, "src/lib/server/ai-execution-http.ts"), "utf8"),
  gemini: await readFile(resolve(root, "src/lib/server/gemini.ts"), "utf8"),
};
const failures = [];

for (const marker of ["AI_CANCELLED", "signal: AbortSignal", "signal?: AbortSignal"]) {
  if (!files.types.includes(marker)) failures.push(`Execution types are missing: ${marker}`);
}
for (const marker of [
  "createExecutionCancellation",
  "waitForAbort",
  "throwIfAborted",
  "signal: cancellation.signal",
  "options.signal",
  "AI_TIMEOUT",
]) {
  if (!files.runtime.includes(marker)) failures.push(`Execution runtime is missing: ${marker}`);
}
if (!files.http.includes("signal: request.signal")) {
  failures.push("HTTP adapter does not pass the client AbortSignal to the execution controller.");
}
for (const marker of [
  "GeminiRequestOptions",
  "signal: options.signal",
  "if (isAbortError(error)) throw error",
]) {
  if (!files.gemini.includes(marker)) failures.push(`Gemini gateway is missing: ${marker}`);
}
if (
  files.runtime.includes('error.code === "AI_TIMEOUT"') &&
  files.runtime.includes("inflightByKey.delete(key)")
) {
  const timeoutCatch = /error\.code === "AI_TIMEOUT"[\s\S]{0,220}inflightByKey\.delete\(key\)/u;
  if (timeoutCatch.test(files.runtime)) {
    failures.push(
      "Timeout still deletes the in-flight idempotency entry before provider settlement.",
    );
  }
}

if (failures.length) {
  console.error("AI cancellation contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("AI cancellation composition, gateway signal and late-result contract passed.");
