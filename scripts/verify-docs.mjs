import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const requiredDocuments = [
  ["README.md", "Lamdan"],
  ["AGENTS.md", "LOVABLE:BEGIN"],
  ["DESIGN_SYSTEM.md", "Academic Content Workspace"],
  ["ROADMAP.md", "Full Product Roadmap"],
  ["TASKS.md", "P0 Implementation Tasks"],
  ["STATUS.md", "Current execution status"],
];

const failures = [];

for (const [fileName, requiredText] of requiredDocuments) {
  try {
    const content = await readFile(resolve(process.cwd(), fileName), "utf8");
    if (content.trim().length < 40) {
      failures.push(`${fileName} is unexpectedly empty.`);
    }
    if (!content.includes(requiredText)) {
      failures.push(`${fileName} is missing required marker: ${requiredText}`);
    }
  } catch (error) {
    failures.push(
      `${fileName} could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (failures.length > 0) {
  console.error("Documentation verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Documentation verification passed (${requiredDocuments.length} files).`);
