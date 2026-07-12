import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const manifestPath = resolve(process.cwd(), args.manifest ?? "evals/fixtures.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const fixtures = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];
const selected = args.suite ? fixtures.filter((fixture) => fixture.suite === args.suite) : fixtures;

if (selected.length === 0) {
  console.error(args.suite ? `No fixtures found for suite: ${args.suite}` : "No fixtures found.");
  process.exit(1);
}

const results = [];
for (const fixture of selected) {
  const candidate = await loadCandidate(fixture, args);
  const positive = evaluateFixture(fixture, candidate, manifest.suiteThresholds ?? {});
  const negative = fixture.negativeCandidate
    ? evaluateFixture(fixture, fixture.negativeCandidate, manifest.suiteThresholds ?? {})
    : null;
  const negativeControlPassed = negative ? !negative.pass : true;
  results.push({
    id: fixture.id,
    suite: fixture.suite,
    kind: fixture.kind,
    weight: finiteNumber(fixture.weight) ?? 1,
    score: positive.score,
    pass: positive.pass && negativeControlPassed,
    positivePass: positive.pass,
    negativeControlPassed,
    metrics: positive.metrics,
    failures: [
      ...positive.failures,
      ...(negativeControlPassed ? [] : ["negative_control_incorrectly_passed"]),
    ],
    source: candidate === fixture.candidate ? "recorded_baseline" : "external_candidate",
  });
}

const suiteResults = summarizeSuites(results, manifest.suiteThresholds ?? {});
const overallScore = weightedAverage(results.map((result) => [result.score, result.weight]));
const overallPass = results.every((result) => result.pass) && suiteResults.every((suite) => suite.pass);
const report = {
  manifestVersion: manifest.version,
  manifest: manifestPath,
  candidateMode: args.candidateDir ? "external" : "recorded_baseline",
  suiteFilter: args.suite ?? null,
  overallScore: round(overallScore),
  overallPass,
  suites: suiteResults,
  fixtures: results,
};

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHumanReport(report);
}

if (!overallPass) process.exit(1);

function evaluateFixture(fixture, candidate, suiteThresholds) {
  switch (fixture.kind) {
    case "structured":
      return evaluateStructured(fixture, candidate, suiteThresholds);
    case "generation":
      return evaluateGeneration(fixture, candidate, suiteThresholds);
    case "ocr":
      return evaluateOCR(fixture, candidate, suiteThresholds);
    default:
      return {
        score: 0,
        pass: false,
        metrics: {},
        failures: [`unsupported_fixture_kind:${fixture.kind}`],
      };
  }
}

function evaluateStructured(fixture, candidate, suiteThresholds) {
  const checks = Array.isArray(fixture.checks) ? fixture.checks : [];
  const outcomes = checks.map((check) => {
    const actual = getPath(candidate, check.path);
    const passed = runStructuredCheck(actual, check);
    return {
      path: check.path,
      op: check.op,
      passed,
      weight: finiteNumber(check.weight) ?? 1,
    };
  });
  const score = weightedAverage(outcomes.map((outcome) => [outcome.passed ? 1 : 0, outcome.weight]));
  const threshold = suiteThreshold(fixture, suiteThresholds);
  return {
    score,
    pass: score >= threshold && outcomes.every((outcome) => outcome.passed),
    metrics: {
      threshold,
      checksPassed: outcomes.filter((outcome) => outcome.passed).length,
      checksTotal: outcomes.length,
    },
    failures: outcomes
      .filter((outcome) => !outcome.passed)
      .map((outcome) => `check_failed:${outcome.path}:${outcome.op}`),
  };
}

function runStructuredCheck(actual, check) {
  switch (check.op) {
    case "equals":
      return deepEqual(actual, check.value);
    case "includes":
      return normalizeText(String(actual ?? "")).includes(normalizeText(String(check.value ?? "")));
    case "arrayIncludes":
      return Array.isArray(actual) && actual.some((value) => deepEqual(value, check.value));
    case "lengthBetween":
      return (
        (Array.isArray(actual) || typeof actual === "string") &&
        actual.length >= (finiteNumber(check.min) ?? 0) &&
        actual.length <= (finiteNumber(check.max) ?? Number.MAX_SAFE_INTEGER)
      );
    case "exists":
      return actual != null && (typeof actual !== "string" || actual.trim().length > 0);
    default:
      return false;
  }
}

function evaluateGeneration(fixture, candidate, suiteThresholds) {
  const expectations = fixture.expectations ?? {};
  const components = [];
  const failures = [];
  const fullText = flattenStrings(candidate).join("\n");

  const requiredTerms = arrayOfStrings(expectations.requiredTerms);
  const requiredTermRecall = recallByContainment(requiredTerms, fullText);
  components.push([requiredTermRecall, 2]);
  if (requiredTermRecall < 1) failures.push("required_terms_missing");

  const exactNumbers = arrayOfStrings(expectations.exactNumbers);
  const exactNumberRecall = recallByLiteral(exactNumbers, fullText);
  components.push([exactNumberRecall, exactNumbers.length ? 1.5 : 0.25]);
  if (exactNumberRecall < 1) failures.push("exact_numbers_missing");

  const forbiddenTerms = arrayOfStrings(expectations.forbiddenTerms);
  const forbiddenFound = forbiddenTerms.filter((term) =>
    normalizeText(fullText).includes(normalizeText(term)),
  );
  const forbiddenScore = forbiddenFound.length === 0 ? 1 : 0;
  components.push([forbiddenScore, 2]);
  if (forbiddenFound.length > 0) failures.push(`forbidden_terms:${forbiddenFound.join("|")}`);

  const requiredFields = arrayOfStrings(expectations.requiredFields);
  const requiredFieldScore = proportion(
    requiredFields.map((path) => hasMeaningfulValue(getPath(candidate, path))),
  );
  components.push([requiredFieldScore, requiredFields.length ? 1 : 0.25]);
  if (requiredFieldScore < 1) failures.push("required_fields_missing");

  const allowedIds = new Set(arrayOfStrings(expectations.allowedSourceChunkIds));
  const citationGroups = [];
  for (const path of arrayOfStrings(expectations.citationPaths)) {
    citationGroups.push(arrayOfStrings(getPath(candidate, path)));
  }

  const items = expectations.itemPath ? getPath(candidate, expectations.itemPath) : undefined;
  if (expectations.itemPath) {
    if (!Array.isArray(items)) {
      failures.push("item_collection_missing");
      components.push([0, 2]);
    } else {
      const minItems = finiteNumber(expectations.minItems) ?? 0;
      const maxItems = finiteNumber(expectations.maxItems) ?? Number.MAX_SAFE_INTEGER;
      const countValid = items.length >= minItems && items.length <= maxItems;
      components.push([countValid ? 1 : 0, 1]);
      if (!countValid) failures.push(`item_count:${items.length}`);

      const itemFields = arrayOfStrings(expectations.itemRequiredFields);
      const itemFieldChecks = items.flatMap((item) =>
        itemFields.map((field) => hasMeaningfulValue(getPath(item, field))),
      );
      const itemFieldScore = proportion(itemFieldChecks);
      components.push([itemFieldScore, itemFields.length ? 1.5 : 0.25]);
      if (itemFieldScore < 1) failures.push("item_fields_missing");

      if (expectations.citationField) {
        for (const item of items) {
          citationGroups.push(arrayOfStrings(getPath(item, expectations.citationField)));
        }
      }

      if (finiteNumber(expectations.exactOptionCount) != null) {
        const expectedCount = finiteNumber(expectations.exactOptionCount);
        const optionChecks = items.map(
          (item) => Array.isArray(item.options) && item.options.length === expectedCount,
        );
        const optionScore = proportion(optionChecks);
        components.push([optionScore, 1.5]);
        if (optionScore < 1) failures.push("option_count_mismatch");
      }
    }
  }

  const citationCoverage = proportion(citationGroups.map((ids) => ids.length > 0));
  const citationPrecision = proportion(
    citationGroups.flatMap((ids) => ids.map((id) => allowedIds.has(id))),
  );
  if (citationGroups.length > 0 || allowedIds.size > 0) {
    components.push([citationCoverage, 2]);
    components.push([citationPrecision, 2]);
    if (citationCoverage < 1) failures.push("uncited_items");
    if (citationPrecision < 1) failures.push("unknown_source_ids");
  }

  if (typeof expectations.notFoundExpected === "boolean") {
    const correct = candidate?.notFoundInSources === expectations.notFoundExpected;
    components.push([correct ? 1 : 0, 1]);
    if (!correct) failures.push("not_found_state_mismatch");
  }

  const score = weightedAverage(components);
  const threshold = suiteThreshold(fixture, suiteThresholds);
  return {
    score,
    pass: score >= threshold && failures.length === 0,
    metrics: {
      threshold,
      requiredTermRecall: round(requiredTermRecall),
      exactNumberRecall: round(exactNumberRecall),
      forbiddenTermCount: forbiddenFound.length,
      citationCoverage: round(citationCoverage),
      citationPrecision: round(citationPrecision),
    },
    failures,
  };
}

function evaluateOCR(fixture, candidate, suiteThresholds) {
  const reference = fixture.reference ?? {};
  const thresholds = fixture.thresholds ?? {};
  const referenceText = String(reference.transcript ?? "");
  const candidateText = String(candidate?.transcript ?? candidate?.text ?? "");
  const normalizedReference = normalizeOCRText(referenceText);
  const normalizedCandidate = normalizeOCRText(candidateText);
  const referenceWords = tokenize(normalizedReference);
  const candidateWords = tokenize(normalizedCandidate);

  const cer = normalizedReference.length === 0
    ? normalizedCandidate.length === 0 ? 0 : 1
    : levenshtein([...normalizedReference], [...normalizedCandidate]) / normalizedReference.length;
  const wer = referenceWords.length === 0
    ? candidateWords.length === 0 ? 0 : 1
    : levenshtein(referenceWords, candidateWords) / referenceWords.length;

  const criticalTokens = arrayOfStrings(reference.criticalTokens);
  const criticalTokenRecall = recallByContainment(criticalTokens, normalizedCandidate);
  const referenceMath = arrayOfStrings(reference.mathExpressions).map(normalizeMath);
  const candidateMath = arrayOfStrings(candidate?.mathExpressions).map(normalizeMath);
  const mathExpressionRecall = referenceMath.length === 0
    ? 1
    : proportion(referenceMath.map((expression) => candidateMath.includes(expression)));

  const referenceLines = arrayOfStrings(reference.lines).map(normalizeOCRText).filter(Boolean);
  const candidateLines = arrayOfStrings(candidate?.lines).map(normalizeOCRText).filter(Boolean);
  const lineOrder = referenceLines.length === 0
    ? candidateLines.length === 0 ? 1 : 0
    : longestCommonSubsequence(referenceLines, candidateLines) / referenceLines.length;

  const referenceTokenSet = new Set(tokenize(normalizedReference));
  const candidateUniqueTokens = Array.from(new Set(candidateWords));
  const hallucinatedTokens = candidateUniqueTokens.filter((token) => !referenceTokenSet.has(token));
  const hallucinatedTokenRate = candidateUniqueTokens.length === 0
    ? 0
    : hallucinatedTokens.length / candidateUniqueTokens.length;

  const reviewRequired = thresholds.requireHonestReview === true || reference.requiresReview === true;
  const reviewHonesty = !reviewRequired ||
    (candidate?.requiresReview === true && arrayOfStrings(candidate?.warnings).length > 0);
  const abstentionRequired = thresholds.requireAbstention === true || reference.mustAbstain === true;
  const abstentionHonesty = !abstentionRequired ||
    (normalizedCandidate.length === 0 && candidateMath.length === 0 && candidate?.requiresReview === true);

  const failures = [];
  const cerMax = finiteNumber(thresholds.cerMax) ?? 0.2;
  const werMax = finiteNumber(thresholds.werMax) ?? 0.3;
  const criticalMin = finiteNumber(thresholds.criticalTokenRecallMin) ?? 0.8;
  const mathMin = finiteNumber(thresholds.mathExpressionRecallMin) ?? 0.8;
  const lineMin = finiteNumber(thresholds.lineOrderMin) ?? 0.8;
  const hallucinationMax = finiteNumber(thresholds.hallucinatedTokenRateMax) ?? 0.15;

  if (cer > cerMax) failures.push(`cer:${round(cer)}>${cerMax}`);
  if (wer > werMax) failures.push(`wer:${round(wer)}>${werMax}`);
  if (criticalTokenRecall < criticalMin) failures.push("critical_token_recall");
  if (mathExpressionRecall < mathMin) failures.push("math_expression_recall");
  if (lineOrder < lineMin) failures.push("line_order");
  if (hallucinatedTokenRate > hallucinationMax) failures.push("hallucinated_tokens");
  if (!reviewHonesty) failures.push("missing_manual_review_state");
  if (!abstentionHonesty) failures.push("failed_to_abstain");

  const componentScores = [
    [Math.max(0, 1 - cer), 2],
    [Math.max(0, 1 - wer), 1.5],
    [criticalTokenRecall, criticalTokens.length ? 2 : 0.25],
    [mathExpressionRecall, referenceMath.length ? 2.5 : 0.25],
    [lineOrder, referenceLines.length ? 1.5 : 0.25],
    [Math.max(0, 1 - hallucinatedTokenRate), 2],
    [reviewHonesty ? 1 : 0, reviewRequired ? 2 : 0.5],
    [abstentionHonesty ? 1 : 0, abstentionRequired ? 3 : 0.25],
  ];
  const score = weightedAverage(componentScores);
  const threshold = suiteThreshold(fixture, suiteThresholds);

  return {
    score,
    pass: score >= threshold && failures.length === 0,
    metrics: {
      threshold,
      cer: round(cer),
      wer: round(wer),
      criticalTokenRecall: round(criticalTokenRecall),
      mathExpressionRecall: round(mathExpressionRecall),
      lineOrder: round(lineOrder),
      hallucinatedTokenRate: round(hallucinatedTokenRate),
      reviewHonesty,
      abstentionHonesty,
    },
    failures,
  };
}

async function loadCandidate(fixture, args) {
  if (!args.candidateDir) return fixture.candidate;
  const candidatePath = resolve(process.cwd(), args.candidateDir, `${fixture.id}.json`);
  if (!existsSync(candidatePath)) {
    if (args.requireExternalCandidates) {
      throw new Error(`Missing external candidate: ${candidatePath}`);
    }
    return fixture.candidate;
  }
  const parsed = JSON.parse(await readFile(candidatePath, "utf8"));
  return parsed?.candidate ?? parsed;
}

function summarizeSuites(results, suiteThresholds) {
  const suites = new Map();
  for (const result of results) {
    const current = suites.get(result.suite) ?? [];
    current.push(result);
    suites.set(result.suite, current);
  }
  return Array.from(suites.entries()).map(([suite, items]) => {
    const score = weightedAverage(items.map((item) => [item.score, item.weight]));
    const threshold = finiteNumber(suiteThresholds[suite]) ?? 0.9;
    return {
      suite,
      score: round(score),
      threshold,
      pass: score >= threshold && items.every((item) => item.pass),
      fixtures: items.length,
    };
  });
}

function printHumanReport(report) {
  console.log(`Lamdan evaluation manifest v${report.manifestVersion}`);
  console.log(`Mode: ${report.candidateMode}${report.suiteFilter ? ` · suite=${report.suiteFilter}` : ""}`);
  console.log("");
  for (const suite of report.suites) {
    console.log(`${suite.pass ? "PASS" : "FAIL"}  ${suite.suite.padEnd(14)} ${formatPercent(suite.score)}  threshold ${formatPercent(suite.threshold)}`);
  }
  console.log("");
  for (const fixture of report.fixtures) {
    const suffix = fixture.failures.length ? ` · ${fixture.failures.join(", ")}` : "";
    console.log(`${fixture.pass ? "✓" : "✗"} ${fixture.id} · ${formatPercent(fixture.score)}${suffix}`);
  }
  console.log("");
  console.log(`${report.overallPass ? "All evaluation gates passed." : "Evaluation gates failed."} Overall ${formatPercent(report.overallScore)}`);
}

function parseArgs(argv) {
  const parsed = {
    json: false,
    suite: undefined,
    manifest: undefined,
    candidateDir: undefined,
    requireExternalCandidates: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") parsed.json = true;
    else if (arg === "--suite") parsed.suite = argv[++index];
    else if (arg === "--manifest") parsed.manifest = argv[++index];
    else if (arg === "--candidate-dir") parsed.candidateDir = argv[++index];
    else if (arg === "--require-external-candidates") parsed.requireExternalCandidates = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function suiteThreshold(fixture, suiteThresholds) {
  return finiteNumber(fixture.threshold) ?? finiteNumber(suiteThresholds[fixture.suite]) ?? 0.9;
}

function recallByContainment(required, text) {
  if (required.length === 0) return 1;
  const normalized = normalizeText(text);
  return proportion(required.map((term) => normalized.includes(normalizeText(term))));
}

function recallByLiteral(required, text) {
  if (required.length === 0) return 1;
  return proportion(required.map((term) => String(text).includes(term)));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOCRText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function normalizeMath(value) {
  return normalizeOCRText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\*+/g, "*");
}

function tokenize(value) {
  return String(value ?? "")
    .toLowerCase()
    .match(/[\p{L}\p{N}\^+\-*/=()]+/gu) ?? [];
}

function flattenStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(flattenStrings);
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
}

function getPath(value, path) {
  if (!path) return value;
  return String(path)
    .split(".")
    .reduce((current, part) => (current == null ? undefined : current[part]), value);
}

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function proportion(values) {
  if (values.length === 0) return 1;
  return values.filter(Boolean).length / values.length;
}

function weightedAverage(entries) {
  const usable = entries.filter((entry) => finiteNumber(entry[1]) > 0);
  const totalWeight = usable.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight === 0) return 0;
  return usable.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight;
}

function levenshtein(left, right) {
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function longestCommonSubsequence(left, right) {
  const table = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      table[leftIndex][rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? table[leftIndex - 1][rightIndex - 1] + 1
        : Math.max(table[leftIndex - 1][rightIndex], table[leftIndex][rightIndex - 1]);
    }
  }
  return table[left.length][right.length];
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function formatPercent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}
