import fs from "node:fs";

const file = fs.readFileSync("src/routes/app.program.tsx", "utf8");
const required = [
  'htmlFor="program-name"',
  'id="program-name"',
  'htmlFor="program-institution"',
  'id="program-institution"',
  'htmlFor="program-degree"',
  'id="program-degree"',
  'htmlFor="program-years"',
  'id="program-years"',
  'htmlFor="program-semesters"',
  'id="program-semesters"',
  'dir="auto"',
];
for (const marker of required) {
  if (!file.includes(marker)) {
    throw new Error(`Missing program form accessibility marker: ${marker}`);
  }
}
console.log("Program form accessibility contract passed");
