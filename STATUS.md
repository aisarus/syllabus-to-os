# Lamdan — Current execution status

Last updated: 2026-07-12

## Current milestone

**Milestone D — AI transformation loop**

## Task status

- `P0-001 Add continuous integration` — complete and verified.
- `P0-002 Audit and normalize all active routes` — complete for the current shell.
- `P0-003 Remove tracking-first product flows` — complete in primary navigation and the course workspace.
- `P0-004 Create one shared intake service` — complete and verified.
- `P0-005 Build multi-file upload queue` — complete and verified on Dashboard and Materials.
- `P0-006 Add duplicate detection` — complete and verified across exact, likely, queue and legacy upload paths.
- `P0-007 Add intake review and correction` — complete and verified.
- `P0-008 Replace material detail with a true workspace` — complete and verified.
- `P0-009 Add chunk editing tools` — complete and verified.
- `P0-010 Add material output history` — complete and verified.
- `P0-011 Connect AI actions to material selection` — complete and verified.
- `P0-012 Upgrade AI draft review` — next.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Selected-source AI contract

- Audited the existing Material Workspace actions for notes, flashcards and quizzes.
- Confirmed that the current material, course, topic and selected chunk IDs are preselected in the reusable AI dialog.
- Confirmed that selected character count and the 20,000-character limit are visible and enforced.
- Confirmed that an empty source selection cannot be submitted.
- Confirmed that saved notes, cards and quiz questions preserve `materialId`, course/topic context and `sourceChunkIds`.
- Confirmed that global AI buttons remain available outside the Material Workspace.
- Added `verify:ai-source-contract`, a regression check that fails when selected-source wiring or source-linked save behavior is removed.
- Added the contract check to the canonical `npm run check` command and GitHub Actions.
- Preserved the dependency lockfile, store schema and existing localStorage data.

## Verification state

- Documentation verification passed.
- Selected-source AI contract verification passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.

## Next execution target

1. Begin `P0-012` with idempotent draft saving and explicit saved state.
2. Add unsaved-change protection.
3. Strengthen editing, removal, addition and reordering for cards and quiz questions.
4. Preserve selected source context after AI failures and retries.

## Blockers

None.
