import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const source = await readFile(
  resolve(process.cwd(), "src/components/ai-draft-modal.tsx"),
  "utf8",
);
const required = ['role="status"', 'aria-live="polite"', 'aria-atomic="true"', 'role="alert"'];
const failures = required.filter((marker) => !source.includes(marker));
if ((source.match(/role="alert"/g) ?? []).length < 3) failures.push("three alert surfaces");
if ((source.match(/role="status"/g) ?? []).length < 2)
  failures.push("loading and saved status surfaces");
if (failures.length) {
  console.error("AI draft modal accessibility contract failed:\n");
  for (const marker of failures) console.error(`- missing ${marker}`);
  process.exit(1);
}
console.log("AI draft modal loading, saved, error and warning live-region contract passed.");
