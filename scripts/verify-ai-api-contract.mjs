import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const routeDir = resolve(root, "src/routes/api/ai");
const routeNames = (await readdir(routeDir)).filter((name) => name.endsWith(".ts")).sort();
const expectedRoutes = [
  "extract-concepts.ts",
  "generate-assignment-breakdown.ts",
  "generate-flashcards.ts",
  "generate-note.ts",
  "generate-presentation-outline.ts",
  "generate-quiz.ts",
  "generate-study-pack.ts",
  "generate-topic-explanation.ts",
  "ocr-image.ts",
  "parse-syllabus.ts",
  "review-open-answer.ts",
  "simplify-text.ts",
  "status.ts",
  "transcribe-long-media.ts",
  "transcription-status.ts",
  "translate-text.ts",
];

const failures = [];
if (JSON.stringify(routeNames) !== JSON.stringify(expectedRoutes)) {
  failures.push(`AI route inventory differs from the expected 16 routes: ${routeNames.join(", ")}`);
}

const routeSources = new Map(
  await Promise.all(
    routeNames.map(async (name) => [name, await readFile(resolve(routeDir, name), "utf8")]),
  ),
);
const contract = await readFile(resolve(root, "src/lib/server/ai-api-contract.ts"), "utf8");
const inventory = await readFile(resolve(root, "docs/AI_API_INVENTORY.md"), "utf8");

for (const [name, source] of routeSources) {
  if (source.includes("request.json()") || source.includes("request.formData()")) {
    failures.push(`${name} bypasses the shared AI request parser.`);
  }
  if (!inventory.includes(`/api/ai/${name.replace(/\.ts$/, "")}`)) {
    failures.push(`Inventory is missing /api/ai/${name.replace(/\.ts$/, "")}.`);
  }
}

const jsonSchemas = new Map([
  ["extract-concepts.ts", "conceptExtractionInputSchema"],
  ["generate-assignment-breakdown.ts", "aiGenerationInputSchema"],
  ["generate-flashcards.ts", "aiGenerationInputSchema"],
  ["generate-note.ts", "aiGenerationInputSchema"],
  ["generate-presentation-outline.ts", "aiGenerationInputSchema"],
  ["generate-quiz.ts", "aiGenerationInputSchema"],
  ["generate-study-pack.ts", "aiGenerationInputSchema"],
  ["generate-topic-explanation.ts", "aiGenerationInputSchema"],
  ["ocr-image.ts", "ocrGenerationInputSchema"],
  ["parse-syllabus.ts", "syllabusParseInputSchema"],
  ["review-open-answer.ts", "openAnswerReviewInputSchema"],
  ["simplify-text.ts", "aiGenerationInputSchema"],
  ["translate-text.ts", "aiGenerationInputSchema"],
]);

for (const [name, schema] of jsonSchemas) {
  const source = routeSources.get(name) ?? "";
  for (const marker of [
    schema,
    name === "parse-syllabus.ts" ? "parseAIJsonRequest" : "handleAIJsonRequest",
  ]) {
    if (!source.includes(marker))
      failures.push(`${name} is missing shared boundary marker: ${marker}`);
  }
}

const transcription = routeSources.get("transcribe-long-media.ts") ?? "";
for (const marker of [
  "parseAIFormDataRequest",
  "transcriptionMetadataSchema",
  "validateAutomaticTranscriptionFile",
  "transcribeWithConfiguredProvider",
]) {
  if (!transcription.includes(marker)) failures.push(`Transcription route is missing: ${marker}`);
}

for (const marker of [
  '"INVALID_JSON"',
  '"INVALID_FORM_DATA"',
  '"INVALID_INPUT"',
  '"PAYLOAD_TOO_LARGE"',
  '"PROVIDER_UNAVAILABLE"',
  '"PROVIDER_ERROR"',
  '"INVALID_PROVIDER_RESPONSE"',
  '"INTERNAL_ERROR"',
  "formatAIValidationDetails",
  "publicMessage",
  "publicDetails",
]) {
  if (!contract.includes(marker)) failures.push(`Shared AI contract is missing: ${marker}`);
}

for (const forbidden of ["details: result.details", "details: res.details", "error.stack"]) {
  for (const [name, source] of routeSources) {
    if (source.includes(forbidden))
      failures.push(`${name} exposes forbidden error data: ${forbidden}`);
  }
}

if (failures.length) {
  console.error("AI API contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("AI API inventory, shared runtime schemas and redacted error envelope passed.");
