import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve(process.cwd(), "src/components/material-intake-review-dialog.tsx"),
  "utf8",
);

const required = [
  'htmlFor="material-review-title"',
  'id="material-review-title"',
  'htmlFor="material-review-type"',
  'id="material-review-type"',
  'htmlFor="material-review-course"',
  'id="material-review-course"',
  'htmlFor="material-review-topic"',
  'id="material-review-topic"',
  'htmlFor="material-review-tags"',
  'id="material-review-tags"',
  '"material-review-extracted-text"',
  'id="material-review-extracted-text"',
  'dir="auto"',
  'role="alert"',
];
const failures = required
  .filter((marker) => !source.includes(marker))
  .map((marker) => `Material intake review is missing: ${marker}`);

if (failures.length) {
  console.error("Material intake review accessibility contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Material intake review labels, bidi fields and alert contract passed.");
