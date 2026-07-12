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
- `P0-016 Upgrade Notes to a reliable editor` — next.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Persistent Course Workspace v1

- Replaced the basic course detail page with a persistent course content workspace.
- Added editable real course metadata, description, topics and weeks.
- Grouped materials by topic and added an explicit unassigned-material section.
- Surfaced syllabus topics with no linked materials without calling the result progress or mastery.
- Added multi-file upload directly into a course through the shared material-intake pipeline.
- Added attachment of existing unassigned library materials.
- Added inline relinking and detaching of materials by topic.
- Added course-scoped notes, flashcards, quizzes and presentation outlines.
- Added inline topic relinking for generated outputs.
- Added course-level note, flashcard and quiz generation using one explicitly selected material and exact selected chunks.
- Added safe course deletion that detaches related content before removing the course and topics.
- Added a permanent `verify:course-workspace-contract` regression check to local checks and CI.
- Preserved the current store schema and localStorage data.

## Verification state

- Documentation verification passed.
- Selected-source AI contract verification passed.
- Syllabus review and confirmation contract verification passed.
- Course Workspace v1 contract verification passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.

## Next execution target

1. Begin `P0-016` with a stable note editor and visible autosave state.
2. Preserve mixed Hebrew/Russian/English editing and source references.
3. Add search, filters, duplicate, merge preview and Markdown export.
4. Add source comparison and selected-text conversion without risking note data.

## Blockers

None.
