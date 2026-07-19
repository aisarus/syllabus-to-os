import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const ledgerRootIndex = args.indexOf("--ledger-root");
const ledgerOnly = ledgerRootIndex >= 0;
const root = resolve(
  process.cwd(),
  ledgerOnly ? (args[ledgerRootIndex + 1] ?? "") : ".",
);

if (ledgerOnly && !args[ledgerRootIndex + 1]) {
  console.error("Documentation verification failed:\n\n- --ledger-root requires a directory.");
  process.exit(1);
}

const requiredDocuments = [
  ["README.md", "Lamdan"],
  ["AGENTS.md", "LOVABLE:BEGIN"],
  ["DESIGN_SYSTEM.md", "Academic Content Workspace"],
  ["ROADMAP.md", "Full Product Roadmap"],
  ["TASKS.md", "P0 Implementation Tasks"],
  ["STATUS.md", "Current execution status"],
  ["PILOT.md", "One-course closed pilot"],
  ["docs/LIVE_OCR_VALIDATION.md", "Live OCR validation"],
];
const ledgerDocuments = ["STATUS.md", "TASKS.md", "PLANS.md"];
const ledgerKeys = [
  "baseline_sha",
  "baseline_pr",
  "active_phase",
  "active_task",
  "active_pr",
  "external_blockers",
];

const failures = [];
const contents = new Map();

async function load(fileName, requiredText = null) {
  try {
    const content = await readFile(resolve(root, fileName), "utf8");
    contents.set(fileName, content);
    if (content.trim().length < 40) failures.push(`${fileName} is unexpectedly empty.`);
    if (requiredText && !content.includes(requiredText)) {
      failures.push(`${fileName} is missing required marker: ${requiredText}`);
    }
  } catch (error) {
    failures.push(
      `${fileName} could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (ledgerOnly) {
  await Promise.all(ledgerDocuments.map((fileName) => load(fileName)));
} else {
  await Promise.all([
    ...requiredDocuments.map(([fileName, marker]) => load(fileName, marker)),
    load("PLANS.md", "Lamdan implementation plans"),
  ]);
}

function parseLedger(fileName) {
  const content = contents.get(fileName) ?? "";
  const match = content.match(/<!--\s*LAMDAN_EXECUTION_LEDGER\s*\n([\s\S]*?)\n-->/u);
  if (!match) {
    failures.push(`${fileName} is missing the LAMDAN_EXECUTION_LEDGER block.`);
    return null;
  }

  const values = {};
  for (const rawLine of match[1].split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) {
      failures.push(`${fileName} has an invalid execution-ledger line: ${line}`);
      continue;
    }
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  for (const key of ledgerKeys) {
    if (!values[key]) failures.push(`${fileName} execution ledger is missing ${key}.`);
  }
  if (values.baseline_sha && !/^[0-9a-f]{40}$/u.test(values.baseline_sha)) {
    failures.push(`${fileName} baseline_sha must be a 40-character lowercase Git SHA.`);
  }
  if (values.baseline_pr && !/^\d+$/u.test(values.baseline_pr)) {
    failures.push(`${fileName} baseline_pr must be numeric.`);
  }
  if (values.active_pr && values.active_pr !== "none" && !/^#\d+$/u.test(values.active_pr)) {
    failures.push(`${fileName} active_pr must be none or #<number>.`);
  }
  return values;
}

const ledgers = new Map(
  ledgerDocuments.map((fileName) => [fileName, parseLedger(fileName)]),
);
const reference = ledgers.get("STATUS.md");
if (reference) {
  for (const [fileName, ledger] of ledgers) {
    if (!ledger || fileName === "STATUS.md") continue;
    for (const key of ledgerKeys) {
      if (ledger[key] !== reference[key]) {
        failures.push(
          `${fileName} execution ledger disagrees with STATUS.md for ${key}: ` +
            `${JSON.stringify(ledger[key])} !== ${JSON.stringify(reference[key])}.`,
        );
      }
    }
  }
}

if (!ledgerOnly) {
  const tasks = contents.get("TASKS.md") ?? "";
  const status = contents.get("STATUS.md") ?? "";
  const plans = contents.get("PLANS.md") ?? "";

  for (const marker of ["P1-005", "P1-006", "P1-007", "P1-008"]) {
    if (!tasks.includes(marker)) failures.push(`TASKS.md is missing task ${marker}.`);
    if (!status.includes(marker)) failures.push(`STATUS.md is missing current status ${marker}.`);
  }
  if (tasks.includes("First task to execute")) {
    failures.push("TASKS.md still contains the obsolete first-task instruction.");
  }
  if (/P0-021[^\n]*Run one-course closed pilot/iu.test(tasks)) {
    failures.push("TASKS.md reintroduces the historical P0-021 identity collision.");
  }

  const activeTask = reference?.active_task;
  if (activeTask) {
    for (const [fileName, content] of [
      ["STATUS.md", status],
      ["TASKS.md", tasks],
      ["PLANS.md", plans],
    ]) {
      const escapedTask = activeTask.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const activeTaskPattern = new RegExp(`Active task[^\n]*${escapedTask}`, "u");
      if (!activeTaskPattern.test(content)) {
        failures.push(`${fileName} does not visibly name active task ${activeTask}.`);
      }
    }
  }

  if (/\*\*Current PR:\*\*\s*#\d+/u.test(tasks) && reference?.active_pr === "none") {
    failures.push("TASKS.md names a current PR while the execution ledger says active_pr: none.");
  }
  if (/active delivery[^\n]*PR\s*#(?:47|48|49|50|51|54|59)/iu.test(status + "\n" + plans)) {
    failures.push("STATUS.md or PLANS.md still promotes a historical PR as active delivery.");
  }
  if (/The PR still requires|Verify and merge[^\n]*PR\s*#48/iu.test(status)) {
    failures.push("STATUS.md still contains pre-merge instructions for an already merged delivery.");
  }
  if (reference?.active_pr === "none" && /## Active implementation pass/iu.test(status)) {
    failures.push("STATUS.md names an active implementation pass while active_pr is none.");
  }
  const nextTargets = status.split("## Next execution targets", 2)[1] ?? "";
  if (reference?.active_task && !nextTargets.includes(reference.active_task)) {
    failures.push("STATUS.md next execution targets do not name the active task.");
  }
}

if (failures.length > 0) {
  console.error("Documentation verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (ledgerOnly) {
  console.log(`Execution-ledger verification passed (${ledgerDocuments.length} documents).`);
} else {
  console.log(
    `Documentation verification passed (${requiredDocuments.length + 1} files and semantic execution-ledger alignment).`,
  );
}
