import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [engine, route, evaluation, packageJson, checkScript, workflow] = await Promise.all([
  read("src/lib/global-search.ts"),
  read("src/routes/app.search.tsx"),
  read("scripts/run-global-search-evals.mjs"),
  read("package.json"),
  read("scripts/check.mjs"),
  read(".github/workflows/ci.yml"),
]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  'GLOBAL_SEARCH_VERSION = "local-search-v2"',
  "normalizeSearchText",
  "parseGlobalSearchQuery",
  "searchWorkspace",
  "countGlobalSearchKinds",
  "findSearchRanges",
  "SEARCH_MARK_PATTERN",
  "fieldMatchScore",
  "kindBoost",
  "courseId?: string",
  "pageNumber?: number",
]) {
  requireMarker(engine, marker, `Global search engine is missing: ${marker}`);
}

for (const marker of [
  'createFileRoute("/app/search")',
  "validateSearch",
  "Route.useSearch()",
  "searchWorkspace(data, search.q",
  "countGlobalSearchKinds",
  "HighlightedText",
  "Фильтр по курсу",
  "Кавычки ищут точную фразу",
  "Иврит ищется одинаково с никудами и без них",
  "replace: true",
]) {
  requireMarker(route, marker, `Global search route is missing: ${marker}`);
}

for (const marker of [
  'normalizeSearchText("מְבוֹא לְמֵידָע")',
  'parseGlobalSearchQuery(\'"information retrieval" precision\')',
  'searchWorkspace(data, "מבוא מידע")',
  'searchWorkspace(data, "precision bronze")',
  'searchWorkspace(data, \'"precision and recall"\')',
  'searchWorkspace(data, "age", { courseId: "course_info" })',
  'searchWorkspace(data, "retrieved items", { kinds: ["flashcard"] })',
  'findSearchRanges("מְבוֹא לְמֵידָע", ["מבוא"])',
  'assert.deepEqual(firstRun, secondRun, "Ranking must be deterministic.")',
]) {
  requireMarker(evaluation, marker, `Global search evaluation is missing: ${marker}`);
}

for (const marker of ['"eval:global-search"', '"verify:global-search-v2-contract"']) {
  requireMarker(packageJson, marker, `package.json is missing: ${marker}`);
}
for (const marker of ["verify:global-search-v2-contract", "eval:global-search"]) {
  requireMarker(checkScript, marker, `npm run check is missing: ${marker}`);
}
for (const marker of ["Verify global search v2 contract", "Run global search v2 evaluations"]) {
  requireMarker(workflow, marker, `CI is missing: ${marker}`);
}

if (failures.length > 0) {
  console.error("Global search v2 contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Ranked multilingual local search, URL state, course/type filters, contextual snippets and deterministic evaluation coverage are wired.",
);
