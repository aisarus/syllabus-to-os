import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pilot = await readFile(resolve(process.cwd(), "PILOT.md"), "utf8");
const preflight = await readFile(resolve(process.cwd(), "scripts/run-pilot-preflight.mjs"), "utf8");
const failures = [];
for (const marker of [
  "pilot-session.json",
  "--base-url",
  "--evidence-dir",
  "Expected result",
  "Evidence file",
  "P1-006",
  "P1-007",
  "P1-008",
  "Do not mark",
]) {
  if (!pilot.includes(marker)) failures.push(`PILOT.md is missing harness marker: ${marker}`);
}
for (const marker of [
  "evidenceDir",
  'relativeEvidence.startsWith("..")',
  "/api/ai/status",
  "/api/ai/transcription-status",
  "externalGates",
  "LAMDAN_PILOT_LIVE_OCR_READY",
  "LAMDAN_PILOT_GOLDEN_QUIZ_READY",
  "pilot-session.json",
]) {
  if (!preflight.includes(marker)) failures.push(`Pilot preflight is missing: ${marker}`);
}
if (failures.length) {
  console.error("Pilot harness contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Pilot setup, external blockers and evidence-path contract passed.");
