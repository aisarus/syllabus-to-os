import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve(process.cwd(), "src/components/ai-side-actions.tsx"), "utf8");
const required = [
  'htmlFor="ai-assignment-estimated-time"',
  'id="ai-assignment-estimated-time"',
  'htmlFor="ai-assignment-steps"',
  'id="ai-assignment-steps"',
  'htmlFor="ai-assignment-checklist"',
  'id="ai-assignment-checklist"',
  'htmlFor="ai-topic-short-explanation"',
  'id="ai-topic-short-explanation"',
  'htmlFor="ai-topic-detailed-explanation"',
  'id="ai-topic-detailed-explanation"',
  'dir="auto"',
];
const failures = required.filter((marker) => !source.includes(marker));
if (failures.length) {
  console.error("AI side actions accessibility contract failed:\n");
  for (const marker of failures) console.error(`- missing ${marker}`);
  process.exit(1);
}
console.log("AI assignment/topic draft labels and bidi contract passed.");
