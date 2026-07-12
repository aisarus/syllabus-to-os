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
- `P0-008 Replace material detail with a true workspace` — complete; CI verification pending for the documentation sync commit.
- `P0-009 Add chunk editing tools` — next.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### True material workspace

- Replaced the tabbed material-detail screen with a responsive three-part workspace.
- Added a source navigator with material-wide search, active-chunk navigation and multi-chunk selection.
- Added select-all, clear-selection and copy-selected-text actions.
- Added page, section and character-count context for source chunks.
- Added an honest full raw-text fallback when stored chunks are unavailable.
- Added editable title, type, course, topic and tags using the existing store mutators.
- Added extraction status, language, diagnostics, file metadata and source counts.
- Added existing output counts, direct quiz links and persisted generation-history visibility.
- Connected note, flashcard and quiz generation actions to the current material, course, topic and selected chunk IDs.
- Preserved the existing localStorage data model; no migration or destructive rewrite was introduced.
- The layout uses normal responsive grid flow without fixed canvas, absolute-positioned room UI, trackers or timers.

## Verification state

- The implementation reuses `getChunksByMaterial`, existing material/output relationships, store mutators and `AIGenerateButton` initial-context inputs.
- Source text renders with automatic direction, supporting long Hebrew and mixed RTL/LTR content.
- Empty source state and raw-text fallback are explicit rather than fabricated.
- `TASKS.md` was not rewritten in this pass because it is a large shared planning document and `STATUS.md` is explicitly authoritative until checkbox updates can be applied safely.
- CI must pass on the documentation sync commit before `P0-008` is considered fully verified.

## Next execution target

1. Inspect existing chunk mutators and dependent `sourceChunkIds` handling.
2. Implement the first dependency-safe slice of `P0-009`: edit chunk title/text and persist changes.
3. Add split, adjacent merge, reorder and guarded deletion in subsequent atomic passes.
4. Ensure deleted or merged chunk IDs are removed or replaced safely in dependent notes, flashcards and quiz questions.

## Blockers

None unless CI reports a concrete failure.
