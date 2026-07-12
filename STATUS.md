# Lamdan — Current execution status

Last updated: 2026-07-12

## Current milestone

**Milestone F — Product-quality content editors**

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
- `P0-012 Upgrade AI draft review` — complete and verified.
- `P0-013 Add AI trust and citation layer` — complete and verified.
- `P0-014 Complete syllabus review and confirmation` — complete and verified.
- `P0-015 Build Course Workspace v1` — complete and verified.
- `P0-016 Upgrade Notes to a reliable editor` — complete and verified.
- `P0-017 Add Flashcard Studio v1` — next.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Reliable source-linked Notes editor

- Replaced the compact inline editor with a dedicated persistent note library and detail workspace.
- Added visible saved, unsaved, saving and error states with debounced autosave.
- Added flush-on-navigation and before-unload protection so ordinary navigation does not lose note text.
- Added Markdown controls for headings, lists, checklists, quotes and tables without introducing a heavy editor dependency.
- Preserved mixed Hebrew, Russian and English editing with automatic text direction.
- Added course, topic, material and exact source-chunk relationships.
- Added source comparison that surfaces possibly missing source sections without claiming knowledge or mastery.
- Added selected-text conversion into an editable flashcard or a fully validated multiple-choice question.
- Added search across note title, body and tags plus course, material and tag filters.
- Added safe duplication and multi-note merge preview.
- Merging creates a new note and preserves every original note.
- Added direct Markdown export.
- Added a permanent `verify:notes-editor-contract` regression check to local checks and CI.
- Preserved the current store schema and localStorage data.

## Verification state

- Documentation verification passed.
- Selected-source AI contract verification passed.
- Syllabus review and confirmation contract verification passed.
- Course Workspace v1 contract verification passed.
- Reliable Notes editor contract verification passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.

## Next execution target

1. Begin `P0-017` Flashcard Studio v1.
2. Add course, topic and material filters plus bulk selection and relinking.
3. Add duplicate detection and guarded merge/delete flows.
4. Keep content editing primary and review scheduling secondary.

## Blockers

None.
