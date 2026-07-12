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
- `P0-006 Add duplicate detection` — complete and verified across exact, likely, queue and legacy upload paths.
- `P0-007 Add intake review and correction` — next.

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
- The remaining legacy single-file Materials upload performs the same exact and likely checks and requires an explicit keep-both confirmation before persistence.

## Verification state

- Documentation verification passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.
- The successful run covers likely matching, extraction-before-persistence and the guarded legacy upload path together.

## Next execution target

1. Begin `P0-007` intake review and correction.
2. Add editable title, material type, course, topic and tags before persistence.
3. Show extracted-text preview and partial/unsupported warnings.
4. Support save, save without course, retry and discard without creating hidden records.

## Blockers

None.
