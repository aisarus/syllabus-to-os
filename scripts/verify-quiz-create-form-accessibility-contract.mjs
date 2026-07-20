import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve(process.cwd(), "src/components/quiz-library.tsx"), "utf8");
const required = [
  'htmlFor="create-quiz-title"',
  'id="create-quiz-title"',
  'aria-label={isRu ? "Курс" : "Course"}',
  'aria-label={isRu ? "Тема" : "Topic"}',
  'aria-label={isRu ? "Материал" : "Material"}',
  'dir="auto"',
];
const failures = required
  .filter((marker) => !source.includes(marker))
  .map((marker) => `Quiz create form is missing: ${marker}`);
if (failures.length) {
  console.error("Quiz create form accessibility contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Quiz create form labels and bidi title contract passed.");
