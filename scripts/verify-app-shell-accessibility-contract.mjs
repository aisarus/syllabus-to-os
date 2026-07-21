import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [source, styles] = await Promise.all([
  readFile(resolve(process.cwd(), "src/components/app-shell.tsx"), "utf8"),
  readFile(resolve(process.cwd(), "src/ux-foundation.css"), "utf8"),
]);

const failures = [];
const requiredSourceMarkers = [
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

for (const marker of requiredSourceMarkers) {
  if (!source.includes(marker)) {
    failures.push(`App shell is missing accessibility marker: ${marker}`);
  }
}

if (!/document\.activeElement === first[\s\S]+last\.focus\(\)/u.test(source)) {
  failures.push("Mobile drawer does not wrap Shift+Tab from the first control to the last.");
}
if (!/document\.activeElement === last[\s\S]+first\.focus\(\)/u.test(source)) {
  failures.push("Mobile drawer does not wrap Tab from the last control to the first.");
}

const requiredStyleMarkers = [
  ".content-skip-link:focus",
  ".content-nav__item:focus-visible",
  ".content-sidebar__collapse:focus-visible",
  ".content-sidebar__primary-action:focus-visible",
  ".content-mobile-header button:focus-visible",
  ".content-mobile-drawer button:focus-visible",
  "outline: 2px solid var(--cw-gold)",
  "outline-offset: 2px",
];

for (const marker of requiredStyleMarkers) {
  if (!styles.includes(marker)) {
    failures.push(`App shell visible-focus CSS is missing: ${marker}`);
  }
}

if (failures.length) {
  console.error("App shell accessibility contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "App shell static accessibility contract passed: skip link, focus trap, Escape, restoration and visible focus styles.",
);
