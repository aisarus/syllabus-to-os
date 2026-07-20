import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve(process.cwd(), "src/routes/app.presentations_.$outlineId.tsx"),
  "utf8",
);

const required = [
  "aria-label={t.title}",
  "aria-label={`${t.delete} ${t.slide} ${idx + 1}`}",
  "htmlFor={`slide-${s.id}-title`}",
  "id={`slide-${s.id}-title`}",
  "htmlFor={`slide-${s.id}-bullets`}",
  "id={`slide-${s.id}-bullets`}",
  "htmlFor={`slide-${s.id}-speaker-notes`}",
  "id={`slide-${s.id}-speaker-notes`}",
  "htmlFor={`slide-${s.id}-source-quote`}",
  "id={`slide-${s.id}-source-quote`}",
  'dir="auto"',
];
const failures = required
  .filter((marker) => !source.includes(marker))
  .map((marker) => `Presentation editor is missing: ${marker}`);

if (failures.length) {
  console.error("Presentation editor accessibility contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Presentation editor labels, icon name and bidi field contract passed.");
