# Live OCR validation with private assets

Recorded OCR candidates prove that Lamdan's scorer works; they do not prove that the currently connected model can read real photos. This workflow runs the actual `/api/ai/ocr-image` route without committing private images.

## Required files

Create a git-ignored directory named `private-ocr-assets`:

```text
private-ocr-assets/
├── printed-hebrew-page-01.jpg
├── handwritten-hebrew-notes-01.jpg
├── handwritten-math-notebook-01.jpg
└── blurred-notebook-photo-01.jpg
```

Use only images you own, created for testing, or are licensed to process. Remove faces, IDs and unrelated personal details.

## Run a connected preview

Use a deployed Lovable preview or another Lamdan deployment where `/api/ai/status` reports the AI provider as configured. The private runner does not need the API key itself; it calls the server route.

```bash
npm run eval:ocr:live -- \
  --base-url https://YOUR-LAMDAN-PREVIEW \
  --asset-dir ./private-ocr-assets
```

Optional arguments:

```text
--candidate-dir ./private-eval-candidates
--manifest ./evals/manifest.json
--locale ru|en
```

## Output

The runner writes one JSON candidate per OCR fixture to `private-eval-candidates/`, including:

- transcript and line order;
- normalized mathematical expressions;
- confidence and review requirement;
- warnings;
- model and prompt versions;
- asset id and generation timestamp.

It then runs the permanent OCR metrics with `--require-external-candidates`. A missing asset or candidate fails the run.

## Interpreting failures

Do not lower a threshold immediately. Classify the failure first:

- Hebrew character substitution;
- lost punctuation or niqqud normalization issue;
- line-order failure;
- invented completion of unreadable text;
- lost sign, exponent, fraction or intermediate math step;
- review flag missing for handwriting;
- failure to abstain on the blurred control;
- bounding region or source-style mismatch.

Record the category, model and prompt version in `PILOT.md` or a private report before changing prompts or preprocessing.

## Privacy rule

Never commit `private-ocr-assets/`, `private-eval-candidates/` or course materials without explicit permission. The public repository should contain only fixture metadata, thresholds and synthetic/approved baselines.
