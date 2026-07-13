import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const [quality, review, route, detail, manifest, runner, packageJson, checkScript, workflow] =
  await Promise.all([
    read("src/lib/golden-quiz-quality.ts"),
    read("src/components/golden-quiz-quality-review.tsx"),
    read("src/routes/app.quiz-quality_.$quizId.tsx"),
    read("src/routes/app.quizzes_.$quizId.tsx"),
    read("evals/golden-quiz-manifest.json"),
    read("scripts/run-golden-quiz-evals.mjs"),
    read("package.json"),
    read("scripts/check.mjs"),
    read(".github/workflows/ci.yml"),
  ]);

const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

for (const marker of [
  'GOLDEN_QUIZ_QUALITY_VERSION = "golden-quiz-quality-v1"',
  "evaluateGoldenQuizQuality",
  "createGoldenQuizEvaluationCandidate",
  "defaultGoldenQuizManualReview",
  "saveGoldenQuizManualReview",
  "downloadGoldenQuizCandidate",
  "option_count",
  "duplicate_option",
  "unknown_citation",
  "unsupported_number",
  "forbidden_meta_option",
  "correct_answer_length_clue",
  "category_mismatch",
  "weak_rationale",
  "correct_rationale_contradiction",
  "missing_prompt_translation",
  "translation_meaning_risk",
  "hint_reveals_answer",
]) {
  requireMarker(quality, marker, `Golden quiz evaluator is missing: ${marker}`);
}

for (const marker of [
  "export function GoldenQuizQualityReview",
  "Automatic score",
  "Manual rubric",
  "Question clarity",
  "Distractor plausibility",
  "Factual correctness",
  "Rationale quality",
  "Translation quality",
  "Source support",
  "Save review",
  "Export candidate",
]) {
  requireMarker(review, marker, `Golden quiz review screen is missing: ${marker}`);
}

requireMarker(route, 'createFileRoute("/app/quiz-quality_/$quizId")', "Quality review route is missing.");
requireMarker(detail, 'to="/app/quiz-quality/$quizId"', "Quiz detail no longer links to quality review.");

const fixtureManifest = JSON.parse(manifest);
requireMarker(manifest, "hebrew-archaeology-periods", "Archaeology fixture is missing.");
requireMarker(manifest, "social-science-instagram-break", "Social science fixture is missing.");
requireMarker(manifest, "information-studies-retrieval", "Information studies fixture is missing.");
requireMarker(manifest, "mixed-hebrew-russian-sociology", "Mixed-language fixture is missing.");
requireMarker(manifest, "dates-and-numbers-israeli-history", "Dates/numbers fixture is missing.");
if (!Array.isArray(fixtureManifest.fixtures) || fixtureManifest.fixtures.length < 5) {
  failures.push("Golden quiz manifest must contain at least five domain fixtures.");
}
for (const fixture of fixtureManifest.fixtures ?? []) {
  if (!fixture.candidate || !fixture.negativeCandidate) {
    failures.push(`${fixture.id ?? "unknown"}: positive or negative candidate is missing.`);
  }
}

for (const marker of [
  "negative control incorrectly passed",
  "unsupported_number",
  "forbidden_meta_option",
  "correct_length_clue",
  "category_mismatch",
  "hint_reveals_answer",
  "All golden quiz quality gates passed",
]) {
  requireMarker(runner, marker, `Golden quiz evaluation runner is missing: ${marker}`);
}

requireMarker(packageJson, '"eval:golden-quiz"', "package.json has no golden quiz eval command.");
requireMarker(
  packageJson,
  '"verify:golden-quiz-quality-contract"',
  "package.json has no golden quiz contract command.",
);
requireMarker(
  checkScript,
  '"verify:golden-quiz-quality-contract"',
  "Canonical checks do not verify golden quiz quality.",
);
requireMarker(checkScript, '"eval:golden-quiz"', "Canonical checks do not run golden quiz evals.");
requireMarker(workflow, "Verify golden quiz quality contract", "CI does not verify golden quiz quality.");
requireMarker(workflow, "Run golden quiz quality fixtures", "CI does not run golden quiz fixtures.");

if (failures.length > 0) {
  console.error("Golden quiz quality contract verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Golden quiz category scoring, negative controls, manual review and candidate export contract passed.");
