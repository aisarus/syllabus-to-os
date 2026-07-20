import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve(process.cwd(), "src/routes/app.lecture-media.tsx"), "utf8");
const failures = [];
for (const marker of [
  'role="button"',
  "tabIndex={busy ? -1 : 0}",
  "aria-disabled={busy}",
  "focus-visible:ring-2",
  'event.key !== "Enter"',
  'event.key !== " "',
  "event.preventDefault()",
  "inputRef.current?.click()",
]) {
  if (!source.includes(marker)) failures.push(`Lecture upload dropzone is missing: ${marker}`);
}
if (!/onKeyDown=\{\(event\) => \{[\s\S]+inputRef\.current\?\.click\(\)/u.test(source)) {
  failures.push("Lecture upload dropzone does not activate its file input from the keyboard.");
}
if (failures.length) {
  console.error("Lecture media accessibility contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Lecture upload keyboard, disabled-state and focus-visible contract passed.");
