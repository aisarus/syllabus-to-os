# Lamdan — Current execution status

Last updated: 2026-07-12

## Current milestone

**Milestone B — Reliable universal intake**

## Task status

- `P0-001 Add continuous integration` — complete and verified.
- `P0-002 Audit and normalize all active routes` — complete for the current shell.
- `P0-003 Remove tracking-first product flows` — complete in primary navigation and the course workspace.
- `P0-004 Create one shared intake service` — complete and verified.
- `P0-005 Build multi-file upload queue` — complete and verified on Dashboard and Materials.
- `P0-006 Add duplicate detection` — exact duplicate preflight implemented; validation in progress.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Exact duplicate preflight

- Added persistent SHA-256 fingerprints without changing the Lamdan store schema.
- Detects a file already saved in the material library.
- Detects identical files submitted in the same active queue.
- Pauses the duplicate item instead of merging or saving it automatically.
- Offers explicit choices: skip or keep both.
- Offers replace only when the existing material has no linked notes, cards, quizzes, outlines or output history.
- Preserves idempotent retry behavior.
- Keeps stale fingerprint entries harmless when their material no longer exists.
- Works through the shared queue used by Dashboard and the Materials multi-file launcher.

## Verification state

- A pull request from `agent/validate-exact-duplicates` runs documentation verification, TypeScript, ESLint and production build against the current implementation.
- Do not mark exact duplicate detection complete until that run succeeds.

## Next execution target

1. Fix any concrete CI failure.
2. Mark exact duplicate preflight verified.
3. Add likely-duplicate detection using filename, size and normalized extracted text without automatically merging records.
4. Remove or redirect the remaining legacy single-file Materials upload path so every file upload uses the same duplicate guard.

## Blockers

None unless CI reports a concrete failure.
