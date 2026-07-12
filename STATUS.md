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
- `P0-006 Add duplicate detection` — exact and likely duplicate handling implemented across queue and legacy upload paths; final validation in progress.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Duplicate review

- Exact matches use persistent SHA-256 fingerprints.
- Likely matches compare normalized file names and sizes.
- Likely matches also compare normalized extracted text when enough text is available.
- Extraction is separated from persistence so a possible duplicate can be reviewed before any material record is saved.
- Prepared extraction is reused after the user chooses keep both or safe replace, avoiding a second extraction pass.
- The queue never merges automatically.
- Explicit queue choices remain skip, keep both and replace only when no linked outputs can be orphaned.
- Dashboard and the Materials multi-file launcher use the same guarded queue.
- The remaining legacy single-file Materials upload now performs the same exact and likely checks and requires an explicit keep-both confirmation before persistence.

## Verification state

- Exact duplicate behavior is already verified by documentation, TypeScript, ESLint and production-build CI.
- A new pull-request run validates likely matching, extraction-before-persistence and the guarded legacy upload path together.
- Do not mark `P0-006` complete until that run succeeds.

## Next execution target

1. Fix any concrete CI failure.
2. Mark `P0-006` fully complete after the full suite passes.
3. Begin `P0-007` intake review and correction with editable title, type, course, topic, tags and extracted-text preview before save.

## Blockers

None unless CI reports a concrete failure.
