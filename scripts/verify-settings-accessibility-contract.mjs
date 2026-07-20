import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve(process.cwd(), "src/routes/app.settings.tsx"), "utf8");
const required = [
  'htmlFor="settings-language"',
  'id="settings-language"',
  'htmlFor="settings-theme"',
  'id="settings-theme"',
  'role="status"',
  'aria-live="polite"',
  'aria-atomic="true"',
  'role="alert"',
];
const failures = required
  .filter((marker) => !source.includes(marker))
  .map((marker) => `Settings accessibility marker is missing: ${marker}`);
if (failures.length) {
  console.error("Settings accessibility contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Settings labels and diagnostic live-region contract passed.");
