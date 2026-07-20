import fs from "node:fs";

const file = fs.readFileSync("src/routes/app.calendar.tsx", "utf8");
const required = [
  'htmlFor="calendar-title"',
  'id="calendar-title"',
  'htmlFor="calendar-type"',
  'id="calendar-type"',
  'htmlFor="calendar-date"',
  'id="calendar-date"',
  'htmlFor="calendar-start-time"',
  'id="calendar-start-time"',
  'htmlFor="calendar-end-time"',
  'id="calendar-end-time"',
  'htmlFor="calendar-course"',
  'id="calendar-course"',
  'htmlFor="calendar-notes"',
  'id="calendar-notes"',
  "Edit event",
  "Delete event",
  "Редактировать событие",
  "Удалить событие",
];
for (const marker of required) {
  if (!file.includes(marker)) {
    throw new Error(`Missing calendar accessibility marker: ${marker}`);
  }
}
console.log("Calendar accessibility contract passed");
