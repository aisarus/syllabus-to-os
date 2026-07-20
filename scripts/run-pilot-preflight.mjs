import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const args = parseArgs(process.argv.slice(2));
const root = process.cwd();
const baseUrl = required(args, "base-url").replace(/\/$/u, "");
const course = required(args, "course");
const institution = required(args, "institution");
const evidenceDir = resolve(required(args, "evidence-dir"));
const appCommit = args.commit ?? readGitCommit(root) ?? process.env.LAMDAN_PILOT_COMMIT;

if (!appCommit || !/^[0-9a-f]{7,40}$/u.test(appCommit)) {
  fail("Provide --commit or LAMDAN_PILOT_COMMIT with the exact tested Git commit.");
}
if (!isAbsolute(evidenceDir)) fail("Evidence directory must resolve to an absolute path.");
const relativeEvidence = relative(root, evidenceDir);
if (!relativeEvidence.startsWith("..") || relativeEvidence === "") {
  fail("Evidence directory must be outside the repository so private assets cannot be committed.");
}

await mkdir(evidenceDir, { recursive: true });
const [aiStatus, transcriptionStatus] = await Promise.all([
  readStatus(`${baseUrl}/api/ai/status`),
  readStatus(`${baseUrl}/api/ai/transcription-status`),
]);

const session = {
  schemaVersion: 1,
  sessionId: randomUUID(),
  startedAt: new Date().toISOString(),
  course,
  institution,
  baseUrl,
  appCommit,
  browserDevice: args["browser-device"] ?? "record-before-execution",
  sourcePackProvenance: args.provenance ?? "record-before-execution",
  providerSnapshot: {
    ai: aiStatus,
    transcription: transcriptionStatus,
  },
  evidenceDirectory: evidenceDir,
  evidencePlan: [
    "00-preflight/pilot-session.json",
    "01-syllabus/result.json",
    "02-intake/result.json",
    "03-ocr/result.json",
    "04-study-outputs/result.json",
    "05-persistence/result.json",
    "06-retrieval-exam/result.json",
    "metrics.json",
    "decision.md",
  ],
  externalGates: {
    liveOcr: gateState("LAMDAN_PILOT_LIVE_OCR_READY"),
    goldenQuiz: gateState("LAMDAN_PILOT_GOLDEN_QUIZ_READY"),
    licensedLecture: gateState("LAMDAN_PILOT_LICENSED_LECTURE_READY"),
  },
  status: "preflight-complete",
};

const preflightDir = resolve(evidenceDir, "00-preflight");
await mkdir(preflightDir, { recursive: true });
const manifestPath = resolve(preflightDir, "pilot-session.json");
await writeFile(manifestPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");

console.log(`Pilot preflight completed: ${manifestPath}`);
console.log(
  `External gates: OCR=${session.externalGates.liveOcr}, quiz=${session.externalGates.goldenQuiz}, lecture=${session.externalGates.licensedLecture}`,
);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) fail(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) fail(`Missing value for --${key}`);
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function required(values, key) {
  const value = values[key]?.trim();
  if (!value) fail(`Missing required --${key}.`);
  return value;
}

function readGitCommit(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

async function readStatus(url) {
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const body = await response.json().catch(() => null);
    return { reachable: true, status: response.status, body };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function gateState(name) {
  return process.env[name] === "1" ? "ready" : "blocked";
}

function fail(message) {
  console.error(`Pilot preflight failed: ${message}`);
  process.exit(1);
}
