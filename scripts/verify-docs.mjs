import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const requiredDocuments = [
  ["README.md", "Lamdan"],
  ["AGENTS.md", "LOVABLE:BEGIN"],
  ["DESIGN_SYSTEM.md", "Academic Content Workspace"],
  ["ROADMAP.md", "Full Product Roadmap"],
  ["TASKS.md", "implementation tasks"],
  ["STATUS.md", "Current execution status"],
  ["PILOT.md", "One-course closed pilot"],
  ["docs/LIVE_OCR_VALIDATION.md", "Live OCR validation"],
];

const failures = [];
const contents = new Map();

for (const [fileName, requiredText] of requiredDocuments) {
  try {
    const content = await readFile(resolve(process.cwd(), fileName), "utf8");
    contents.set(fileName, content);
    if (content.trim().length < 40) failures.push(`${fileName} is unexpectedly empty.`);
    if (!content.includes(requiredText)) {
      failures.push(`${fileName} is missing required marker: ${requiredText}`);
    }
  } catch (error) {
    failures.push(
      `${fileName} could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const tasks = contents.get("TASKS.md") ?? "";
const status = contents.get("STATUS.md") ?? "";
for (const marker of ["P1-005", "P1-006", "P1-007", "P1-008"]) {
  if (!tasks.includes(marker)) failures.push(`TASKS.md is missing active task ${marker}.`);
  if (!status.includes(marker)) failures.push(`STATUS.md is missing current status ${marker}.`);
}
if (tasks.includes("First task to execute")) {
  failures.push("TASKS.md still contains the obsolete first-task instruction.");
}
if (/P0-021[^\n]*Run one-course closed pilot/iu.test(tasks)) {
  failures.push("TASKS.md reintroduces the historical P0-021 identity collision.");
}

if (failures.length > 0) {
  console.error("Documentation verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Documentation verification passed (${requiredDocuments.length} files and active-task alignment).`,
);
