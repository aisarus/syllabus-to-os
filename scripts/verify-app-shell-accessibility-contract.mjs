import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve(process.cwd(), "src/components/app-shell.tsx"), "utf8");
const failures = [];
const required = [
  "content-skip-link",
  'href="#lamdan-main-content"',
  'id="lamdan-main-content"',
  "mobileMenuButtonRef",
  "mobileDrawerRef",
  "mobileCloseButtonRef",
  "focusableSelector",
  'event.key === "Escape"',
  'event.key !== "Tab"',
  "mobileCloseButtonRef.current?.focus()",
  "mobileMenuButtonRef.current?.focus()",
  'aria-modal="true"',
  'aria-labelledby="lamdan-mobile-navigation-title"',
  "tabIndex={-1}",
];
for (const marker of required) {
  if (!source.includes(marker))
    failures.push(`App shell is missing accessibility marker: ${marker}`);
}
if (!/document\.activeElement === first[\s\S]+last\.focus\(\)/u.test(source)) {
  failures.push("Mobile drawer does not wrap Shift+Tab from the first control to the last.");
}
if (!/document\.activeElement === last[\s\S]+first\.focus\(\)/u.test(source)) {
  failures.push("Mobile drawer does not wrap Tab from the last control to the first.");
}
if (failures.length) {
  console.error("App shell accessibility contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  "App shell skip-link, dialog focus trap, Escape and focus restoration contract passed.",
);
