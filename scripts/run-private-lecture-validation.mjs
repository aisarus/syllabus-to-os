import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
  estimateCost,
  evaluateLectureCandidate,
} from "./private-lecture-validation-metrics.mjs";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const manifestPath = resolve(
  String(args.manifest || "private-lecture-assets/manifest.json"),
);
const reportDir = resolve(String(args["report-dir"] || "private-eval-reports"));
const requiredLanguages = String(args["require-languages"] || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

if (!existsSync(manifestPath)) {
  throw new Error(`Private lecture manifest does not exist: ${manifestPath}`);
}
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
validateManifest(manifest);
const manifestDir = resolve(manifestPath, "..");
const fixtures = selectFixtures(manifest.fixtures, args.fixture);
const presentLanguages = new Set(fixtures.map((fixture) => fixture.language));
for (const language of requiredLanguages) {
  if (!presentLanguages.has(language)) {
    throw new Error(
      `Required language is absent from selected fixtures: ${language}`,
    );
  }
}

const results = [];
for (const fixture of fixtures) {
  const mediaPath = resolve(manifestDir, fixture.file);
  const referencePath = resolve(manifestDir, fixture.referenceFile);
  const candidatePath = resolve(manifestDir, fixture.candidateFile);
  for (const [kind, path] of [
    ["media", mediaPath],
    ["reference transcript", referencePath],
    ["provider candidate", candidatePath],
  ]) {
    if (!existsSync(path))
      throw new Error(`${fixture.id}: ${kind} is missing: ${path}`);
  }
  const [mediaStats, reference, candidate] = await Promise.all([
    stat(mediaPath),
    readFile(referencePath, "utf8"),
    readJson(candidatePath),
  ]);
  validateCandidate(fixture, candidate);
  const evaluation = evaluateLectureCandidate({
    reference,
    segments: candidate.segments,
    language: fixture.language,
    durationSeconds: fixture.durationSeconds,
    latencyMs: candidate.latencyMs,
    requestSpeakerLabels: fixture.requestSpeakerLabels === true,
    thresholds: fixture.thresholds,
  });
  const costRate = numberOrNull(
    candidate.usdPerAudioMinute ?? manifest.usdPerAudioMinute,
  );
  const result = {
    id: fixture.id,
    language: fixture.language,
    passed: evaluation.passed,
    failures: evaluation.failures,
    metrics: evaluation.metrics,
    thresholds: fixture.thresholds,
    fileName: basename(mediaPath),
    fileBytes: mediaStats.size,
    durationSeconds: fixture.durationSeconds,
    provider: stringOrNull(candidate.provider),
    model: stringOrNull(candidate.model),
    requestId: stringOrNull(candidate.requestId),
    providerWarnings: Array.isArray(candidate.warnings)
      ? candidate.warnings.map(String)
      : [],
    estimatedCostUsd: estimateCost(fixture.durationSeconds, costRate),
    candidateGeneratedAt: stringOrNull(candidate.generatedAt),
  };
  results.push(result);
  console.log(
    `${result.passed ? "✓" : "✗"} ${fixture.id}: WER ${percent(result.metrics.wer)} · CER ${percent(result.metrics.cer)} · coverage ${percent(result.metrics.timestampCoverage)} · RTF ${formatNumber(result.metrics.realtimeFactor)}`,
  );
  if (!result.passed) console.error(`  ${result.failures.join("; ")}`);
}

await mkdir(reportDir, { recursive: true });
const report = {
  format: "lamdan-private-lecture-validation",
  version: 1,
  generatedAt: new Date().toISOString(),
  sourceManifest: basename(manifestPath),
  fixtures: results,
  summary: summarize(results),
};
const stamp = report.generatedAt.replace(/[:.]/gu, "-");
const jsonPath = join(reportDir, `lecture-validation-${stamp}.json`);
const markdownPath = join(reportDir, `lecture-validation-${stamp}.md`);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(markdownPath, renderMarkdown(report));
console.log(`Reports:\n- ${jsonPath}\n- ${markdownPath}`);
if (!report.summary.passed) process.exitCode = 1;

function validateManifest(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.fixtures) ||
    value.fixtures.length === 0
  ) {
    throw new Error(
      "Private lecture manifest must be version 1 with at least one fixture.",
    );
  }
  const ids = new Set();
  for (const fixture of value.fixtures) {
    for (const field of [
      "id",
      "file",
      "referenceFile",
      "candidateFile",
      "language",
    ]) {
      if (!String(fixture?.[field] || "").trim())
        throw new Error(`Fixture is missing ${field}.`);
    }
    if (ids.has(fixture.id))
      throw new Error(`Duplicate fixture id: ${fixture.id}`);
    ids.add(fixture.id);
    if (
      !Number.isFinite(fixture.durationSeconds) ||
      fixture.durationSeconds <= 0
    ) {
      throw new Error(`${fixture.id}: durationSeconds must be positive.`);
    }
    if (!fixture.thresholds || typeof fixture.thresholds !== "object") {
      throw new Error(`${fixture.id}: explicit thresholds are required.`);
    }
  }
}

function validateCandidate(fixture, candidate) {
  if (
    !candidate ||
    candidate.format !== "lamdan-private-lecture-candidate" ||
    candidate.version !== 1
  ) {
    throw new Error(
      `${fixture.id}: candidate must use lamdan-private-lecture-candidate v1.`,
    );
  }
  if (!Array.isArray(candidate.segments) || candidate.segments.length === 0) {
    throw new Error(`${fixture.id}: candidate has no segments.`);
  }
  if (!Number.isFinite(candidate.latencyMs) || candidate.latencyMs < 0) {
    throw new Error(`${fixture.id}: candidate latencyMs is required.`);
  }
}

function selectFixtures(fixtures, value) {
  if (!value) return fixtures;
  const requested = new Set(
    String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const selected = fixtures.filter((fixture) => requested.has(fixture.id));
  const missing = [...requested].filter(
    (id) => !selected.some((fixture) => fixture.id === id),
  );
  if (missing.length)
    throw new Error(`Unknown fixture ids: ${missing.join(", ")}`);
  return selected;
}

function summarize(values) {
  const passedCount = values.filter((result) => result.passed).length;
  const costs = values
    .map((result) => result.estimatedCostUsd)
    .filter(Number.isFinite);
  return {
    passed: values.length > 0 && passedCount === values.length,
    total: values.length,
    passedCount,
    failedCount: values.length - passedCount,
    totalEstimatedCostUsd:
      costs.length === values.length
        ? costs.reduce((sum, value) => sum + value, 0)
        : null,
  };
}

function renderMarkdown(report) {
  const rows = report.fixtures.map((result) => {
    const metrics = result.metrics;
    return `| ${escapePipe(result.id)} | ${result.language} | ${result.passed ? "PASS" : "FAIL"} | ${percent(metrics.wer)} | ${percent(metrics.cer)} | ${percent(metrics.timestampCoverage)} | ${formatNumber(metrics.speakerLabelCoverage)} | ${formatNumber(metrics.realtimeFactor)} | ${result.estimatedCostUsd === null ? "—" : `$${result.estimatedCostUsd.toFixed(4)}`} |`;
  });
  const failures = report.fixtures
    .filter((result) => !result.passed)
    .map((result) => `- **${result.id}:** ${result.failures.join("; ")}`);
  return `# Lamdan private lecture validation\n\n- Generated: ${report.generatedAt}\n- Result: **${report.summary.passed ? "PASS" : "FAIL"}**\n\n| Fixture | Language | Result | WER | CER | Timestamp coverage | Speaker coverage | RTF | Estimated cost |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows.join("\n")}\n\n## Failures\n\n${failures.length ? failures.join("\n") : "None."}\n`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h") parsed.help = true;
    else if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = values[index + 1];
      if (!next || next.startsWith("--")) parsed[key] = true;
      else {
        parsed[key] = next;
        index += 1;
      }
    }
  }
  return parsed;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function stringOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function percent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—";
}

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value).toFixed(3) : "—";
}

function escapePipe(value) {
  return String(value).replace(/\|/gu, "\\|");
}

function printHelp() {
  console.log(
    `Evaluate private Hebrew/Russian lecture candidates without network access.\n\nUsage:\n  npm run eval:lecture:private -- --manifest private-lecture-assets/manifest.json --require-languages he,ru\n\nGenerate provider candidates through Lamdan's explicit-consent UI, save them beside the private reference transcript, then run this offline evaluator. Private assets and reports are gitignored.`,
  );
}
