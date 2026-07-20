import fs from "node:fs";

const file = fs.readFileSync("src/routes/app.settings.tsx", "utf8");
const required = [
  'htmlFor="settings-language"',
  'id="settings-language"',
  'htmlFor="settings-theme"',
  'id="settings-theme"',
  'role="status"',
  'aria-live="polite"',
  'aria-atomic="true"',
];
for (const marker of required) {
  if (!file.includes(marker)) {
    throw new Error(`Missing settings accessibility marker: ${marker}`);
  }
}
console.log("Settings accessibility contract passed");
