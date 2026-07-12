# Lamdan — Current execution status

Last updated: 2026-07-12

## Current milestone

**Milestone E — Syllabus and course brain**

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
- `P0-015 Build Course Workspace v1` — next.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Universal syllabus review and confirmation

- Replaced the active spreadsheet-only mapper with a universal review workspace.
- Added PDF, DOCX, XLSX/XLS, CSV, TXT/Markdown and pasted-text intake through the shared document extraction pipeline.
- Added deterministic parsing for course title, code, instructor, credits, semester, description and weekly topics.
- Added extraction and editing for readings, assignments, exams and grading sections.
- Added overall and per-field confidence indicators plus visible uncertainty warnings.
- Added manual add, edit, delete and exclude controls for courses and extracted list items.
- Added previous-import detection and matching-course detection by course code or normalized title.
- Kept every course, topic, material and note mutation behind one explicit confirmation step.
- Added safe create, update or skip decisions per reviewed course.
- Reimport merges topics without deleting existing topics or creating normalized-title duplicates.
- Confirmed syllabi are stored as linked syllabus materials with extracted chunks and as reviewed syllabus notes.
- Added a permanent `verify:syllabus-review-contract` regression check to local checks and CI.
- Preserved current localStorage compatibility; no destructive schema migration was introduced.

## Verification state

- Documentation verification passed.
- Selected-source AI contract verification passed.
- Syllabus review and confirmation contract verification passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.

## Next execution target

1. Build `P0-015` Course Workspace v1 on top of reviewed syllabus data.
2. Group materials by topic and surface unassigned course materials.
3. Show notes, cards, quizzes and uncovered syllabus topics in the course.
4. Add course-level AI actions with explicit source selection only.

## Blockers

None.
