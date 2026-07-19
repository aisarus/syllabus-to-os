import { readFile } from "node:fs/promises";

const routeFiles = [
  "generate-note",
  "generate-flashcards",
  "generate-quiz",
  "generate-presentation-outline",
  "simplify-text",
  "translate-text",
  "generate-assignment-breakdown",
  "generate-topic-explanation",
  "generate-study-pack",
  "ocr-image",
  "extract-concepts",
  "review-open-answer",
  "parse-syllabus",
];
const failures = [];
const policy = await readFile("src/lib/server/ai-route-policy.ts", "utf8");
const schemas = await readFile("src/lib/server/ai-route-schemas.ts", "utf8");
const gemini = await readFile("src/lib/server/gemini.ts", "utf8");

for (const marker of [
  "Idempotency-Key",
  "AI_BUDGET_EXCEEDED",
  "AI_CONCURRENCY_LIMIT",
  "PAYLOAD_TOO_LARGE",
  "INVALID_INPUT",
  "x-request-id",
  "AbortController",
]) {
  if (!policy.includes(marker)) failures.push(`AI route policy is missing: ${marker}`);
}
for (const marker of [
  "aiGenerationInputSchema",
  "ocrGenerationInputSchema",
  "syllabusParseInputSchema",
]) {
  if (!schemas.includes(marker)) failures.push(`AI route schemas are missing: ${marker}`);
}
for (const marker of [
  "PROVIDER_TIMEOUT_MS",
  "MAX_PROVIDER_ATTEMPTS",
  "signal: controller.signal",
]) {
  if (!gemini.includes(marker)) failures.push(`Gemini provider hardening is missing: ${marker}`);
}
for (const route of routeFiles) {
  const content = await readFile(`src/routes/api/ai/${route}.ts`, "utf8");
  if (!content.includes("handleAIJSONRequest")) failures.push(`${route} bypasses shared policy.`);
  if (content.includes("(await request.json()) as"))
    failures.push(`${route} still trusts a raw cast.`);
}
if (failures.length > 0) {
  console.error("AI route policy contract failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Shared AI runtime validation and resource-control contract passed.");
