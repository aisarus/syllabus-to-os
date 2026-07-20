import fs from "node:fs";

const file = fs.readFileSync("src/routes/app.assignments.tsx", "utf8");
const required = [
  'htmlFor="assignment-title"',
  'id="assignment-title"',
  'htmlFor="assignment-course"',
  'id="assignment-course"',
  'htmlFor="assignment-due-date"',
  'id="assignment-due-date"',
  'htmlFor="assignment-status"',
  'id="assignment-status"',
  'htmlFor="assignment-priority"',
  'id="assignment-priority"',
  'htmlFor="assignment-grade"',
  'id="assignment-grade"',
  'htmlFor="assignment-notes"',
  'id="assignment-notes"',
  "Edit assignment",
  "Delete assignment",
  "Редактировать задание",
  "Удалить задание",
];
for (const marker of required) {
  if (!file.includes(marker)) {
    throw new Error(`Missing assignments accessibility marker: ${marker}`);
  }
}
console.log("Assignments accessibility contract passed");
