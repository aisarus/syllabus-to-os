import fs from "node:fs";

const file = fs.readFileSync("src/routes/app.presentations.tsx", "utf8");
const required = [
  'dir="auto"',
  "aria-label={t.title}",
  "Delete presentation",
  "Удалить презентацию",
];
for (const marker of required) {
  if (!file.includes(marker)) {
    throw new Error(`Missing presentations accessibility marker: ${marker}`);
  }
}
console.log("Presentations accessibility contract passed");
