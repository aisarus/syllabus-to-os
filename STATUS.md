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
- `P0-014 Complete syllabus review and confirmation` — next.

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

- Documentation verification passed.
- Selected-source, draft-review and citation-trust contract verification passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.
- The client follow-up is based on current `main` after the server contract from PR #13, avoiding any duplicated or conflicting server rewrite.

## Next execution target

1. Begin `P0-014` by auditing the current syllabus intake, deterministic parser, AI parser and review-state boundaries.
2. Reuse the shared material intake pipeline for PDF, DOCX, XLSX and pasted syllabus text.
3. Keep every course/topic mutation behind explicit confirmation.
4. Make reimport duplicate-safe and preserve user corrections.

## Blockers

None.
