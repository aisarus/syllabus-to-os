import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const context = await readFile(
  resolve(root, "src/lib/server/ai-provider-signal-context.ts"),
  "utf8",
);
const runtime = await readFile(resolve(root, "src/lib/server/ai-execution-runtime.ts"), "utf8");
const gemini = await readFile(resolve(root, "src/lib/server/gemini.ts"), "utf8");
const transcription = await readFile(
  resolve(root, "src/lib/server/automatic-transcription-provider.ts"),
  "utf8",
);
const failures = [];

for (const marker of [
  "AsyncLocalStorage<AbortSignal>",
  "runWithAIProviderSignal",
  "currentAIProviderSignal",
]) {
  if (!context.includes(marker)) failures.push(`Provider signal context is missing: ${marker}`);
}
if (!runtime.includes("runWithAIProviderSignal(options.signal")) {
  failures.push("Execution runtime does not scope provider calls to the composed signal.");
}
if (!gemini.includes("options.signal ?? currentAIProviderSignal()")) {
  failures.push("Gemini fetch does not fall back to the execution-scoped signal.");
}
if (!transcription.includes("currentAIProviderSignal() ?? input.signal")) {
  failures.push("Transcription does not prefer the composed execution signal.");
}

if (failures.length) {
  console.error("AI provider signal-context contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("AI provider signal context contract passed.");
