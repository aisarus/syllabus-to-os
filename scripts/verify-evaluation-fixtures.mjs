import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), "evals/manifest.json");
const runnerPath = resolve(process.cwd(), "scripts/run-evals.mjs");
const ocrContractPath = resolve(process.cwd(), "src/lib/ocr-contract.ts");
const [manifestText, runner, ocrContract] = await Promise.all([
  readFile(manifestPath, "utf8"),
  readFile(runnerPath, "utf8"),
  readFile(ocrContractPath, "utf8"),
]);
const manifest = JSON.parse(manifestText);
const fixtures = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];
const failures = [];

const requireCondition = (condition, message) => {
  if (!condition) failures.push(message);
};
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

requireCondition(manifest.version === 1, "Evaluation manifest must use version 1.");
requireCondition(fixtures.length >= 7, "Evaluation manifest must contain at least seven fixtures.");

const ids = fixtures.map((fixture) => fixture.id);
requireCondition(new Set(ids).size === ids.length, "Evaluation fixture ids must be unique.");

for (const suite of ["syllabus", "grounding", "multilingual", "ocr"]) {
  requireCondition(
    fixtures.some((fixture) => fixture.suite === suite),
    `Evaluation manifest is missing the ${suite} suite.`,
  );
  requireCondition(
    typeof manifest.suiteThresholds?.[suite] === "number",
    `Evaluation manifest is missing a numeric threshold for ${suite}.`,
  );
}

for (const fixture of fixtures) {
  requireCondition(Boolean(fixture.id), "Every fixture requires an id.");
  requireCondition(Boolean(fixture.suite), `${fixture.id ?? "unknown"}: suite is missing.`);
  requireCondition(Boolean(fixture.kind), `${fixture.id ?? "unknown"}: kind is missing.`);
  requireCondition(
    fixture.candidate != null,
    `${fixture.id ?? "unknown"}: recorded candidate is missing.`,
  );
  requireCondition(
    fixture.negativeCandidate != null,
    `${fixture.id ?? "unknown"}: negative control is missing.`,
  );
}

const ocrFixtures = fixtures.filter((fixture) => fixture.kind === "ocr");
requireCondition(ocrFixtures.length >= 4, "OCR suite must contain at least four fixtures.");
requireCondition(
  ocrFixtures.some(
    (fixture) => fixture.input?.sourceStyle === "printed" && fixture.input?.containsMath === false,
  ),
  "OCR suite is missing printed Hebrew text.",
);
requireCondition(
  ocrFixtures.some(
    (fixture) =>
      fixture.input?.sourceStyle === "handwritten" && fixture.input?.containsMath === false,
  ),
  "OCR suite is missing handwritten Hebrew text.",
);
requireCondition(
  ocrFixtures.some(
    (fixture) =>
      fixture.input?.sourceStyle === "handwritten" && fixture.input?.containsMath === true,
  ),
  "OCR suite is missing handwritten mathematics.",
);
requireCondition(
  ocrFixtures.some(
    (fixture) =>
      fixture.reference?.mustAbstain === true && fixture.thresholds?.requireAbstention === true,
  ),
  "OCR suite is missing an unreadable-image abstention fixture.",
);

for (const fixture of ocrFixtures) {
  requireCondition(
    fixture.input?.assetStatus === "private_or_licensed_required",
    `${fixture.id}: real-photo privacy/licensing policy is missing.`,
  );
  requireCondition(
    typeof fixture.reference?.transcript === "string",
    `${fixture.id}: reference transcript is missing.`,
  );
  requireCondition(
    Array.isArray(fixture.reference?.lines),
    `${fixture.id}: reference lines are missing.`,
  );
  requireCondition(
    Array.isArray(fixture.reference?.criticalTokens),
    `${fixture.id}: critical token list is missing.`,
  );
  requireCondition(
    Array.isArray(fixture.reference?.mathExpressions),
    `${fixture.id}: math expression list is missing.`,
  );
  requireCondition(
    typeof fixture.candidate?.requiresReview === "boolean",
    `${fixture.id}: review state is missing from the recorded candidate.`,
  );
}

for (const marker of [
  "cerMax",
  "werMax",
  "criticalTokenRecallMin",
  "mathExpressionRecallMin",
  "hallucinatedTokenRateMax",
  "negative_control_incorrectly_passed",
  "--candidate-dir",
  "--require-external-candidates",
]) {
  requireMarker(runner, marker, `Evaluation runner is missing required behavior: ${marker}`);
}

for (const marker of [
  'export const OCR_PROMPT_VERSION = "ocr-draft-v1"',
  'export type OCRSourceStyle = "printed" | "handwritten" | "whiteboard" | "mixed"',
  "kind: OCRRegionKind",
  "normalizedMath?: string",
  "uncertainTokens: string[]",
  "requiresReview: boolean",
  "boundingBox?: OCRBoundingBox",
  "normalizeOCRDraft",
  "validateOCRDraft",
  "ocrDraftToChunks",
]) {
  requireMarker(ocrContract, marker, `OCR contract is missing required behavior: ${marker}`);
}

if (/data:image\/(?:png|jpeg|webp);base64/i.test(manifestText)) {
  failures.push("Evaluation manifest must not embed personal photo bytes or base64 image data.");
}

if (failures.length > 0) {
  console.error("Evaluation fixture verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Evaluation fixtures and OCR readiness contract passed.");
