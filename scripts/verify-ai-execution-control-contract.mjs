import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const routeDir = resolve(root, "src/routes/api/ai");
const names = (await readdir(routeDir)).filter((name) => name.endsWith(".ts")).sort();
const failures = [];
const executionFiles = [
  "ai-execution-types.ts",
  "ai-execution-protocol.ts",
  "ai-execution-state.ts",
  "ai-execution-runtime.ts",
  "ai-execution-control.ts",
];
const executionSources = await Promise.all(
  executionFiles.map((name) => readFile(resolve(root, "src/lib/server", name), "utf8")),
);
const controller = executionSources.join("\n");
const facade = executionSources.at(-1) ?? "";
const httpAdapter = await readFile(resolve(root, "src/lib/server/ai-execution-http.ts"), "utf8");
const requiredControllerMarkers = [
  "AIExecutionPolicy",
  "AI_CONCURRENCY_LIMIT",
  "AI_RATE_LIMIT",
  "AI_COST_LIMIT",
  "AI_TIMEOUT",
  "IDEMPOTENCY_CONFLICT",
  "MAX_IDEMPOTENCY_ENTRIES",
  "MAX_CACHED_RESPONSE_BYTES",
  "executeAIRequest",
  "x-request-id",
  "x-original-request-id",
  "retryAfterSeconds",
];
for (const marker of requiredControllerMarkers) {
  if (!controller.includes(marker)) failures.push(`Execution modules are missing: ${marker}`);
}
for (const marker of [
  'export * from "./ai-execution-types.ts"',
  'export * from "./ai-execution-protocol.ts"',
  "executeAIRequest",
  "resetAIExecutionStateForTests",
]) {
  if (!facade.includes(marker)) failures.push(`Execution facade is missing: ${marker}`);
}
for (const marker of ["handleControlledAIJsonRequest", "parseAIJsonRequest", "aiResultResponse"]) {
  if (!httpAdapter.includes(marker)) failures.push(`HTTP execution adapter is missing: ${marker}`);
}

const specialized = new Set(["parse-syllabus.ts", "transcribe-long-media.ts"]);
const status = new Set(["status.ts", "transcription-status.ts"]);
for (const name of names) {
  const source = await readFile(resolve(routeDir, name), "utf8");
  if (status.has(name)) {
    if (!source.includes("createAIRequestId") || !source.includes("withAIExecutionHeaders")) {
      failures.push(`${name} does not expose request IDs.`);
    }
    continue;
  }
  if (specialized.has(name)) {
    for (const marker of ["executeAIRequest", "readIdempotencyKey", "AIExecutionError"]) {
      if (!source.includes(marker)) failures.push(`${name} is missing execution marker: ${marker}`);
    }
    continue;
  }
  if (!source.includes("handleControlledAIJsonRequest")) {
    failures.push(`${name} bypasses controlled AI execution.`);
  }
  if (source.includes("handleAIJsonRequest(")) {
    failures.push(`${name} still calls the uncontrolled JSON helper.`);
  }
}

if (failures.length) {
  console.error("AI execution-control contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("AI request IDs, bounded execution and idempotency route contract passed.");
