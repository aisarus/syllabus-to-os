# Lamdan — Current execution status

Last updated: 2026-07-13

## Current milestone

**Milestone G — Validation and release readiness**

Lamdan is a late MVP / early closed alpha. The core local-first source → review → study-output loop is implemented, but M1 is not yet proven on one complete real course.

## Completed task state

- `P0-001` through `P0-020` — complete and verified.
- `P0-021 Durable image intake and OCR review` — complete and verified.
- `P0-022A Image Preprocessing Workspace` — complete and verified; PR #28 CI passed.
- `P0-022B OCR Region Overlay and Sync` — complete and verified; PR #29 CI passed.
- `P0-022C Full Visual Backup and Restore` — complete and verified; PR #30 CI passed.
- `P0-023 Quizlet-style cards and golden generated quizzes` — complete and verified.
- `P1-001 Multi-page image materials` — complete and verified; PR #31 CI passed.
- `P1-002 Golden quiz quality evaluation` — complete and verified; PR #32 CI passed.
- `P1-003 Critical browser end-to-end coverage` — complete and verified; PR #33 CI passed.
- `P1-004 Local-first global search v2` — complete and verified; PR #34 CI passed.
- `P1-005 Store persistence and source-integrity hardening` — complete in the current branch.

`TASKS.md` is now the canonical task ledger and no longer leaves shipped P0 work marked as not started.

## Completed in the current execution pass

### Honest browser-local persistence

- Added a workspace persistence guard that compares current in-memory state with the exact `lamdan.data.v1` browser snapshot after every store update.
- A failed or quota-blocked write now produces a persistent bilingual warning instead of allowing the user to trust the tab silently.
- The warning offers an immediate retry, a non-destructive emergency JSON export and a link to Data management.
- The existing Notes editor now receives a thrown save failure through a compatibility wrapper, so its current `try/catch` displays `Save failed` instead of `Saved` when localStorage did not accept the update.
- The v1 localStorage schema and all existing mutator call sites remain compatible.

### Source-reference integrity during OCR changes

- Added deterministic chunk matching by section, page, order, title, text and positional fallback.
- Normal OCR replacement preserves old chunk ids whenever the source region still represents the same logical content.
- A lifecycle repair pass catches legacy and multi-page paths that already created replacement ids and remaps notes, flashcards, quiz questions and presentation slides.
- References to genuinely removed chunks are pruned instead of remaining dangling.
- Added pure deterministic evaluations for stable-id replacement, legacy remapping, slide references and storage quota failure.

### Live OCR validation runner

- Added `npm run eval:ocr:live` for a private/licensed real-photo pack.
- The runner calls the deployed `/api/ai/ocr-image` route, records model and prompt metadata, writes candidates outside git and executes the existing OCR thresholds.
- Private assets remain outside the repository.

### Documentation repair

- Replaced the stale checkbox backlog with a canonical completed-history and active-validation sequence.
- Removed the old `P0-021` identity collision by reserving it for durable OCR and naming the one-course pilot `P1-008`.
- Added an executable `PILOT.md` and private OCR validation guide.

## Verification state

- Store persistence and source-integrity deterministic evaluations pass locally.
- Private OCR runner help/argument path executes locally.
- Existing CI still needs to run on the branch for all repository contracts, evaluation suites, TypeScript, ESLint, production build and critical Chromium E2E.

## Next execution targets

1. `P1-006` — run the connected multimodal provider against the private real-photo pack.
2. `P1-007` — generate and manually approve one golden quiz from a complete Hebrew source pack.
3. `P1-008` — run the complete one-course closed personal pilot.
4. `P1-009` — add page reorder, partial OCR failure and page-level restore browser scenarios.
5. `P1-010` — add audio transcription only after M1 validation.

## External blockers

- Live OCR quality cannot be measured without the four private/licensed photos and a reachable deployment with the AI provider configured.
- Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.
- M1 remains unachieved until the one-course pilot passes.
