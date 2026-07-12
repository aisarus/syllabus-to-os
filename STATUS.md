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
- `P0-012 Upgrade AI draft review` — complete and verified.
- `P0-013 Add AI trust and citation layer` — in progress; server trust contract implemented.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### AI source trust contract

- Added a versioned AI prompt contract (`study-grounding-v1`).
- Required structured `sourceChunkIds` for notes, flashcards, quiz questions and presentation slides.
- Validated every returned source chunk ID against the exact chunks included in the request.
- Removed unknown source IDs and emitted explicit RU/EN warnings instead of accepting fabricated references.
- Added uncited-item counting and visible warnings when generated items contain no validated selected-source citation.
- Added explicit `notFoundInSources` behavior and warnings when selected sources are insufficient.
- Strengthened prompts against fabricated facts, source IDs and page numbers.
- Added model, prompt version, requested source IDs and rejected source IDs as trust metadata for debugging.
- Preserved the existing store schema and localStorage data.

## Verification state

- Repository state, `TASKS.md`, `STATUS.md` and the existing AI architecture were inspected before implementation.
- The change was isolated to the server AI generation contract; no store or localStorage migration was introduced.
- Pull request mergeability was verified and PR #13 was squash-merged into `main` as `3ea796f483ea4667317f624dbac262156f2c8d77`.
- GitHub Actions had not yet reported a workflow run for the commit at the time of this update; CI verification remains pending.

## Next execution target

1. Surface trust warnings and `notFoundInSources` states in the AI draft review UI.
2. Display supporting chunks for notes as well as cards, questions and slides.
3. Add regression coverage for unknown IDs, uncited items and prompt/model metadata.
4. Run and record TypeScript, ESLint, production build and AI trust contract checks.

## Blockers

None.
