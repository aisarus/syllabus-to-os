# Lamdan evaluation fixtures

This directory contains deterministic quality gates for the product's riskiest transformations:

- syllabus structure extraction;
- source-grounded notes and quizzes;
- Hebrew terminology preserved inside Russian explanations;
- printed-page OCR;
- handwritten Hebrew recognition;
- handwritten mathematics recognition;
- honest abstention on unreadable photos.

## What the recorded candidates mean

The `candidate` values in `manifest.json` are known-good contract baselines. They let CI verify that the scorers, thresholds and negative controls behave correctly without calling a paid model or pretending that live OCR is already connected.

Every fixture also contains a deliberately bad `negativeCandidate`. CI fails when a negative control accidentally passes. That protects the benchmark from becoming a set of assertions that always return green.

## Commands

```bash
npm run eval
npm run eval:ocr
npm run eval:json
npm run verify:evaluation-fixtures
```

Evaluate externally produced outputs:

```bash
node scripts/run-evals.mjs \
  --manifest evals/manifest.json \
  --candidate-dir ./private-eval-candidates \
  --require-external-candidates
```

The candidate directory uses one JSON file per fixture:

```text
private-eval-candidates/
├── ocr-printed-hebrew-page.json
├── ocr-handwritten-hebrew-notes.json
├── ocr-handwritten-math-notebook.json
└── ocr-unreadable-photo-abstention.json
```

A file may contain either the candidate object directly or `{ "candidate": { ... } }`.

## OCR metrics

OCR is not scored only by a vague similarity number.

- **CER** — character error rate after Unicode, punctuation and Hebrew-niqqud normalization.
- **WER** — word error rate.
- **Critical-token recall** — preservation of names, Hebrew terms, variables, operators and answers that cannot be safely lost.
- **Math-expression recall** — normalized expressions such as `x^2-4x+3=0` are evaluated separately from prose.
- **Line order** — notebook steps must remain in reading order.
- **Hallucinated-token rate** — invented words, values and formulas are penalized.
- **Review honesty** — handwriting and low-confidence regions must request manual review.
- **Abstention honesty** — an unreadable photo must produce an empty/uncertain draft rather than a confident invented solution.

## Real-photo asset packs

The public repository stores fixture metadata and ground truth, not private notebook photos. Real images should live in a private or licensed asset pack and be mapped to the fixture `assetId` values locally or in a protected CI job.

Recommended private pack structure:

```text
private-ocr-assets/
├── printed-hebrew-page-01.jpg
├── handwritten-hebrew-notes-01.jpg
├── handwritten-math-notebook-01.jpg
└── blurred-notebook-photo-01.jpg
```

Do not commit a student's notebook, face, ID, lecturer material or copyrighted course pack without permission.

## Adding a fixture

A new fixture must include:

1. a stable unique id;
2. an explicit suite and kind;
3. a reference or check set;
4. a passing recorded candidate;
5. a negative candidate that fails for the correct reason;
6. numeric thresholds;
7. source/privacy metadata for OCR assets.

The canonical structural gate is `npm run verify:evaluation-fixtures`.
