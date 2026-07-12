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
- `P0-013 Add AI trust and citation layer` — server contract merged; typed client trust UI and regression validation in progress.
- `P0-014 Complete syllabus review and confirmation` — next after validation.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### AI source trust contract and draft diagnostics

- Added a versioned AI prompt contract (`study-grounding-v1`).
- Required structured `sourceChunkIds` for notes, flashcards, quiz questions and presentation slides.
- Validated every returned source chunk ID against the exact request scope.
- Removed unknown IDs and emitted explicit RU/EN warnings rather than accepting fabricated references.
- Added uncited-item counting and explicit `notFoundInSources` behavior.
- Strengthened prompts against fabricated facts, source IDs and page numbers.
- Added typed frontend metadata for model, prompt version, requested IDs, rejected IDs and uncited-item count.
- Added a visible draft trust panel with validated and review-required states.
- Added a prominent warning when selected sources are insufficient.
- Added regression coverage for server grounding rules, client metadata and trust diagnostics.
- Preserved the current store schema and localStorage data.

## Verification state

- The server trust contract is merged in `main` through PR #13.
- A clean follow-up branch from current `main` contains only the typed client trust UI, regression checks and status documentation.
- Do not mark `P0-013` complete until documentation, AI contract, TypeScript, ESLint and production build checks pass together.

## Next execution target

1. Fix any concrete CI failure in the client trust layer.
2. Mark `P0-013` complete after the full suite passes.
3. Begin `P0-014` by auditing current syllabus intake and review boundaries.
4. Keep all syllabus store mutations behind explicit user confirmation.

## Blockers

None unless CI reports a concrete failure.
