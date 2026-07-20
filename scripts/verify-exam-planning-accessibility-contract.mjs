import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve(process.cwd(), "src/components/exam-planning-panel.tsx"),
  "utf8",
);

const required = [
  "WEEKDAY_NAMES_RU",
  "WEEKDAY_NAMES_EN",
  'role="group"',
  "aria-label={accessibleName}",
  "aria-pressed={selected}",
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-ring",
];
const failures = required
  .filter((marker) => !source.includes(marker))
  .map((marker) => `Exam planning weekday controls are missing: ${marker}`);

if (!/availableWeekdays\.includes\(day\)[\s\S]+aria-pressed=\{selected\}/u.test(source)) {
  failures.push("Weekday pressed state is not derived from the selected weekday collection.");
}

if (failures.length) {
  console.error("Exam planning accessibility contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Exam planning weekday names, pressed state and focus contract passed.");
