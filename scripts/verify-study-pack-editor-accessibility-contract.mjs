import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve(process.cwd(), "src/components/study-pack-editor.tsx"),
  "utf8",
);

const required = [
  'htmlFor="study-pack-title"',
  'id="study-pack-title"',
  'htmlFor="study-pack-orientation"',
  'id="study-pack-orientation"',
  'htmlFor="study-pack-estimated-minutes"',
  'id="study-pack-estimated-minutes"',
  'aria-describedby="study-pack-estimated-minutes-help"',
  'id="study-pack-estimated-minutes-help"',
  'dir="auto"',
];

const failures = required
  .filter((marker) => !source.includes(marker))
  .map((marker) => `Study Pack metadata controls are missing: ${marker}`);

if (failures.length) {
  console.error("Study Pack editor accessibility contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Study Pack metadata labels, help text and bidi contract passed.");
