import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const manifestPath = resolve(process.cwd(), "evals/golden-quiz-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const results = manifest.fixtures.map((fixture) => {
  const positive = evaluateCandidate(fixture.candidate, fixture.sources, fixture.requireRussianTranslation);
  const negative = evaluateCandidate(
    fixture.negativeCandidate,
    fixture.sources,
    fixture.requireRussianTranslation,
  );
  return {
    id: fixture.id,
    domain: fixture.domain,
    positive,
    negative,
    pass: positive.pass && !negative.pass,
  };
});

const report = {
  version: manifest.version,
  qualityVersion: manifest.qualityVersion,
  pass: results.every((result) => result.pass),
  fixtures: results,
};

if (args.has("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Golden quiz quality evaluation · ${report.qualityVersion}`);
  console.log("");
  for (const result of results) {
    console.log(
      `${result.pass ? "✓" : "✗"} ${result.id} · positive ${percent(result.positive.score)} · negative ${percent(result.negative.score)}`,
    );
    if (!result.positive.pass) {
      for (const issue of result.positive.issues) console.log(`  positive: ${issue}`);
    }
    if (result.negative.pass) console.log("  negative control incorrectly passed");
  }
  console.log("");
  console.log(report.pass ? "All golden quiz quality gates passed." : "Golden quiz quality gates failed.");
}

if (!report.pass) process.exit(1);

function evaluateCandidate(candidate, sources, requireRussianTranslation) {
  const sourceById = new Map(sources.map((source) => [source.id, source.text]));
  const questionResults = candidate.questions.map((question) =>
    evaluateQuestion(question, sourceById, requireRussianTranslation),
  );
  const categories = mergeCategories(questionResults.flatMap((result) => result.categories));
  const score = weightedScore(categories);
  const issues = questionResults.flatMap((result) => result.issues);
  const pass =
    questionResults.length > 0 &&
    issues.every((issue) => !issue.startsWith("error:")) &&
    categories.every((category) => category.score >= thresholdFor(category.category)) &&
    score >= 0.86;
  return { pass, score: round(score), categories, issues };
}

function evaluateQuestion(question, sourceById, requireRussianTranslation) {
  const checks = new Map();
  const issues = [];
  const add = (category, pass, severity, code) => {
    const values = checks.get(category) ?? [];
    values.push(pass);
    checks.set(category, values);
    if (!pass) issues.push(`${severity}:${code}:${question.id}`);
  };

  const options = Array.isArray(question.options) ? question.options : [];
  const normalizedOptions = options.map(normalize);
  const feedback = parseFeedback(question.explanation ?? "", options.length);
  const correctIndex = question.correctIndex;
  const correctAnswer = options[correctIndex] ?? "";
  const citedSources = (question.sourceChunkIds ?? [])
    .map((id) => sourceById.get(id))
    .filter(Boolean);
  const sourceText = citedSources.join("\n");

  add("structure", options.length === 4, "error", "option_count");
  add("structure", normalizedOptions.filter(Boolean).length === 4, "error", "empty_option");
  add("structure", new Set(normalizedOptions).size === 4, "error", "duplicate_option");
  add(
    "structure",
    Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < 4,
    "error",
    "correct_index",
  );
  add("structure", String(question.prompt ?? "").trim().length >= 8, "warning", "short_prompt");

  add("sourceSupport", (question.sourceChunkIds ?? []).length > 0, "error", "missing_citation");
  add(
    "sourceSupport",
    (question.sourceChunkIds ?? []).every((id) => sourceById.has(id)),
    "error",
    "unknown_citation",
  );
  add("sourceSupport", sourceText.trim().length > 0, "error", "empty_source_scope");
  const answerTokens = tokens(correctAnswer);
  add(
    "sourceSupport",
    answerTokens.length === 0 || answerTokens.some((token) => normalize(sourceText).includes(token)),
    "manual",
    "weak_answer_support",
  );
  const candidateNumbers = numbers(
    [
      question.prompt,
      correctAnswer,
      feedback.correctExplanation,
      feedback.optionRationales[correctIndex] ?? "",
    ].join(" "),
  );
  const sourceNumbers = new Set(numbers(sourceText));
  add(
    "sourceSupport",
    candidateNumbers.every((value) => sourceNumbers.has(value)),
    "error",
    "unsupported_number",
  );

  options.forEach((option) => {
    add(
      "distractors",
      !/(?:all of the above|none of the above|все перечислен|ничего из перечислен|כל התשובות נכונות|אף תשובה אינה נכונה)/i.test(
        option,
      ),
      "error",
      "forbidden_meta_option",
    );
    add(
      "distractors",
      normalize(option).length >= 3 && !/^[a-dא-ד]$/i.test(normalize(option)),
      "error",
      "junk_option",
    );
  });
  const lengths = options.map((option) => option.trim().length).filter(Boolean);
  const median = medianValue(lengths);
  add(
    "distractors",
    median === 0 || correctAnswer.trim().length <= median * 1.8,
    "warning",
    "correct_length_clue",
  );
  add(
    "distractors",
    options.filter((option) => sameSurfaceCategory(option, correctAnswer)).length >= 3,
    "manual",
    "category_mismatch",
  );

  add("rationales", feedback.optionRationales.length === 4, "error", "rationale_count");
  for (const rationale of feedback.optionRationales) {
    add(
      "rationales",
      rationale.trim().length >= 12 && !/^(incorrect|wrong|неверно|неправильно|לא נכון|שגוי)\.?$/i.test(rationale.trim()),
      "warning",
      "weak_rationale",
    );
  }
  add(
    "rationales",
    feedback.correctExplanation.trim().length >= 16,
    "warning",
    "weak_correct_explanation",
  );
  add(
    "rationales",
    !/(?:incorrect|wrong|неверн|неправильн|לא נכון|שגוי)/i.test(
      feedback.optionRationales[correctIndex] ?? "",
    ),
    "error",
    "correct_rationale_contradiction",
  );

  const translationRequired = requireRussianTranslation || /[\u0590-\u05ff]/.test(question.prompt ?? "");
  add(
    "translation",
    !translationRequired || Boolean(feedback.promptTranslation.trim()),
    "warning",
    "missing_prompt_translation",
  );
  add(
    "translation",
    !translationRequired || feedback.optionTranslations.filter((value) => value.trim()).length === 4,
    "warning",
    "missing_option_translation",
  );

  add("memoryHint", feedback.memoryHint.trim().length >= 8, "warning", "missing_memory_hint");
  add(
    "memoryHint",
    !hintRevealsAnswer(feedback.memoryHint, correctAnswer),
    "warning",
    "hint_reveals_answer",
  );

  add("answerBalance", correctIndex >= 0 && correctIndex < 4, "error", "answer_position");

  return {
    categories: [...checks.entries()].map(([category, values]) => ({
      category,
      passed: values.filter(Boolean).length,
      total: values.length,
      score: ratio(values),
    })),
    issues,
  };
}

function parseFeedback(value, optionCount) {
  const read = (headings) => {
    for (const heading of headings) {
      const match = value.match(
        new RegExp(`###\\s+${escapeRegex(heading)}\\s*\\n([\\s\\S]*?)(?=\\n\\n###\\s+|$)`, "i"),
      );
      if (match) return match[1].trim();
    }
    return "";
  };
  const numbered = (headings) => {
    const section = read(headings);
    const result = Array.from({ length: optionCount }, () => "");
    for (const line of section.split(/\r?\n/)) {
      const match = line.match(/^\s*(\d+)\.\s*(.*)$/);
      if (!match) continue;
      const index = Number(match[1]) - 1;
      if (index >= 0 && index < result.length) result[index] = match[2].trim();
    }
    return result;
  };
  return {
    correctExplanation: read(["Правильный ответ", "Correct explanation"]),
    memoryHint: read(["Как запомнить", "Memory hint"]),
    optionRationales: numbered(["Разбор вариантов", "Option rationales"]),
    promptTranslation: read(["Перевод вопроса", "Prompt translation"]),
    optionTranslations: numbered(["Переводы вариантов", "Option translations"]),
  };
}

function mergeCategories(values) {
  const names = [
    "structure",
    "sourceSupport",
    "distractors",
    "rationales",
    "translation",
    "memoryHint",
    "answerBalance",
  ];
  return names.map((category) => {
    const selected = values.filter((value) => value.category === category);
    const passed = selected.reduce((sum, value) => sum + value.passed, 0);
    const total = selected.reduce((sum, value) => sum + value.total, 0);
    return { category, passed, total, score: total > 0 ? passed / total : 1 };
  });
}

function weightedScore(categories) {
  const weights = {
    structure: 2,
    sourceSupport: 2.5,
    distractors: 2,
    rationales: 1.5,
    translation: 1,
    memoryHint: 0.75,
    answerBalance: 0.5,
  };
  const total = categories.reduce((sum, value) => sum + weights[value.category], 0);
  return categories.reduce((sum, value) => sum + value.score * weights[value.category], 0) / total;
}

function thresholdFor(category) {
  if (category === "structure" || category === "sourceSupport") return 1;
  if (category === "distractors" || category === "rationales") return 0.85;
  return 0.75;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function numbers(value) {
  return [...new Set(String(value ?? "").match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [])];
}

function sameSurfaceCategory(left, right) {
  const leftNumber = /^[-+]?\d/.test(left.trim());
  const rightNumber = /^[-+]?\d/.test(right.trim());
  if (leftNumber || rightNumber) return leftNumber === rightNumber;
  const leftWords = tokens(left).length;
  const rightWords = tokens(right).length;
  return Math.abs(leftWords - rightWords) <= Math.max(3, Math.ceil(rightWords * 0.8));
}

function hintRevealsAnswer(hint, answer) {
  const answerTokens = tokens(answer).filter((token) => token.length >= 4);
  if (answerTokens.length === 0) return false;
  const normalizedHint = normalize(hint);
  return answerTokens.filter((token) => normalizedHint.includes(token)).length / answerTokens.length >= 0.8;
}

function medianValue(values) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function ratio(values) {
  return values.length ? values.filter(Boolean).length / values.length : 1;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "what",
  "which",
  "как",
  "что",
  "для",
  "это",
  "или",
  "של",
  "את",
  "על",
  "מה",
  "איזה",
]);
