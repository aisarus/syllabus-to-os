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
- `P0-013 Add AI trust and citation layer` — implemented; CI validation pending.
- `P0-014 Complete syllabus review and confirmation` — next after validation.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### AI trust and citation layer

- Strengthened server prompts to prohibit invented facts, source IDs and page numbers.
- Added explicit `notFoundInSources` behavior when the selected material cannot support the requested result.
- Added a versioned prompt contract: `study-grounding-v1`.
- Validates every AI-returned `sourceChunkId` against the actual request scope.
- Removes unknown source IDs and exposes them through warnings and trust diagnostics.
- Counts generated notes, cards, questions and slides that lack a validated citation.
- Preserves original Hebrew academic terminology in multilingual generation instructions.
- Added model, prompt version, requested source IDs, rejected source IDs and uncited-item count to typed frontend draft metadata.
- Added an in-draft trust panel showing validated state or a source-review warning.
- Added an explicit warning when information is not found in selected sources.
- Extended the permanent AI contract check to cover prompt versioning, citation validation, unknown-ID rejection and trust UI.
- Preserved the existing store schema and localStorage data.

## Verification state

- A pull request must run documentation, AI contract, TypeScript, ESLint and production-build checks against the complete implementation.
- Do not mark `P0-013` verified until every quality gate passes.

## Next execution target

1. Fix any concrete CI failure in the trust layer.
2. Mark `P0-013` complete after the full suite passes.
3. Begin `P0-014` by auditing current syllabus intake, deterministic parsing and review-state boundaries.
4. Keep all syllabus store mutations behind explicit user confirmation.

## Blockers

None unless CI reports a concrete failure.
