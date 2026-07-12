# Lamdan — Current execution status

Last updated: 2026-07-12

## Current milestone

**Milestone C — Material Workspace**

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
- `P0-010 Add material output history` — next.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Safe chunk editing

- Added editing for chunk titles and extracted text.
- Added split-at-cursor with ordered creation of the second chunk.
- Added merge-with-next while preserving the complete source text.
- Added move-up and move-down controls that change the order used by AI.
- Added guarded deletion with a visible count of dependent source references.
- Rewrites `sourceChunkIds` safely across notes, flashcards, quiz questions and presentation slides.
- Split references expand from the original chunk to both resulting chunks.
- Merge references from the removed chunk are redirected to the retained chunk.
- Delete removes only the deleted chunk ID from dependent outputs.
- Rebuilds material raw text, character count and word count after each structural change.
- Preserves page and section metadata where logically possible.
- Extracted the material workspace into a reusable component without changing the store schema.
- Preserved localStorage compatibility and the existing selected-source AI workflow.

## Verification state

- Documentation verification passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.
- The successful pull-request run covers the workspace extraction, editing, split, merge, reorder and guarded deletion implementation.

## Next execution target

1. Begin `P0-010` material output history.
2. Record note, flashcard, quiz and outline generations consistently.
3. Open linked outputs from the material workspace and display missing entities honestly.
4. Allow deleting a history entry without deleting its linked output.

## Blockers

None.
