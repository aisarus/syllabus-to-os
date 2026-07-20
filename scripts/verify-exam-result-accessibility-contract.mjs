import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve(process.cwd(), "src/components/exam-result-review-list.tsx"),
  "utf8",
);

const required = [
  'role="status"',
  'aria-live="polite"',
  'aria-atomic="true"',
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-ring",
];
const failures = required
  .filter((marker) => !source.includes(marker))
  .map((marker) => `Exam result review is missing: ${marker}`);

if (!/<summary[\s\S]*focus-visible:ring-2/u.test(source)) {
  failures.push("Exam result disclosure summary does not expose visible keyboard focus.");
}

if (failures.length) {
  console.error("Exam result accessibility contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Exam result live-status and disclosure-focus contract passed.");
