# Lamdan

Lamdan is an AI-first academic content workspace for students in Israel. It turns syllabi and study materials into structured courses, searchable source content, notes, flashcards and quizzes while preserving links back to the original material.

## Product direction

The current product foundation is **Academic Content Workspace**: a restrained editorial interface focused on courses, materials, notes, flashcards and quizzes. Tracking dashboards, streaks, timers and illustrated-room interfaces are not part of the core product.

Read the project contracts before implementation:

- `AGENTS.md` — repository and agent rules;
- `ROADMAP.md` — long-term product roadmap;
- `TASKS.md` — canonical completed history and active task sequence;
- `DESIGN_SYSTEM.md` — permanent visual and UX rules;
- `STATUS.md` — current evidence and blockers;
- `PILOT.md` — one-course release-validation script.

## Local setup

The repository uses `bun.lock` as its dependency lockfile.

```bash
bun install --frozen-lockfile
npm run dev
```

## Canonical verification

Before committing a task, run:

```bash
npm run check
```

That command verifies documentation alignment, permanent product contracts, deterministic evaluation suites, TypeScript, ESLint and the production build. GitHub Actions additionally runs the critical real-Chromium flows for pull requests and pushes to `main`.

Useful focused checks:

```bash
npm run verify:docs
npm run eval:store-safety
npm run eval:ocr
npm run typecheck
npm run lint
npm run build
```

## Private live OCR validation

Real OCR quality is measured against private or licensed photos rather than committed course material:

```bash
npm run eval:ocr:live -- \
  --base-url https://YOUR-LAMDAN-PREVIEW \
  --asset-dir ./private-ocr-assets
```

See `docs/LIVE_OCR_VALIDATION.md` for the required filenames, privacy rules and failure categories.
