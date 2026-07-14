# Lamdan — Current execution status

Last updated: 2026-07-14

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live validation. Study Command Center, Lecture-to-Study-Pack, Concept Graph v1, per-question quiz evidence, Workspace backup v2, Reviewed concept extraction and Open-answer evidence with mistake repair are implemented and verified. Final edited-batch concept collision hardening is the active pass.

## Completed task state

- `P0-001` through `P0-020` — complete and verified.
- `P0-021 Durable image intake and OCR review` — complete and verified.
- `P0-022A Image Preprocessing Workspace` — complete and verified; PR #28 CI passed.
- `P0-022B OCR Region Overlay and Sync` — complete and verified; PR #29 CI passed.
- `P0-022C Full Visual Backup and Restore` — complete and verified; PR #30 CI passed.
- `P0-023 Quizlet-style cards and golden generated quizzes` — complete and verified.
- `P1-001 Multi-page image materials` — complete and verified; PR #31 CI passed.
- `P1-002 Golden quiz quality evaluation` — complete and verified; PR #32 CI passed.
- `P1-003 Critical browser end-to-end coverage` — complete and verified; PR #33 CI passed.
- `P1-004 Add local-first global search v2` — complete and verified; PR #34 CI passed.
- `P1-005 Store persistence and source-integrity hardening` — complete and verified; PR #35 CI passed and merged.
- `P1-011 Study Command Center v1` — complete and verified; PR #36 merged.
- `P1-012 Lecture-to-Study-Pack` — complete and verified; PR #37 merged.
- `P1-013 Concept graph and evidence model v1` — complete and verified; PR #38 merged.
- `P1-013A Per-question quiz evidence` — complete and verified; PR #39 merged.
- `P1-013B Workspace backup v2` — complete and verified; PR #41 merged after all contracts, evals, build and three Chromium gates.
- `P1-013C Reviewed concept extraction` — complete and verified; PR #42 merged after all contracts, evals, typecheck, lint, build and four Chromium gates.
- `P1-013D Open-answer evidence and mistake repair` — complete and verified; PR #43 merged after all contracts, evals, typecheck, lint, build and five Chromium gates.

## Current implementation pass — Final edited-batch concept collision guard

**Status:** implemented on `agent/concept-review-collision-guard`; full CI pending.

Delivered:

- pure `planConceptCandidateAcceptance` final validation immediately before persistence;
- full title+alias comparison against the current course map;
- full title+alias comparison against earlier accepted candidates in the same edited batch;
- explicit `duplicate_existing`, `duplicate_batch` and `invalid` rejection reasons;
- stale or removed source relationships rejected at the final persistence boundary;
- review UI recalculates collisions after every manual title or alias edit;
- colliding candidates are disabled and show a visible reason before acceptance;
- final acceptance reruns the same guard even if UI state was stale;
- valid candidates can still be saved while invalid or colliding candidates remain in review;
- deterministic alias→title, alias→alias, existing-alias and stale-source regression coverage;
- existing reviewed concept extraction Chromium remains an end-to-end regression gate.

Current boundaries:

- candidate ordering determines which of two colliding new concepts is retained; the first valid selected candidate wins and the later collision remains for editing;
- live AI extraction quality still requires a configured provider and licensed source pack;
- no automatic ontology or hidden relationship inference is introduced.

## Verification state

Pending on the current branch:

- all repository contracts and deterministic evaluations;
- TypeScript;
- ESLint and formatting;
- production build;
- all five existing Chromium flows.

The branch must not merge until every gate passes.

## Existing validation blockers

### P1-006

Live OCR quality cannot be measured without four private/licensed photos and a reachable deployment with the AI provider configured.

### P1-007

Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.

### P1-008

The one-course closed pilot depends on P1-006 and P1-007. M1 remains unachieved until the complete script passes.

## Next execution targets

1. Verify and merge final concept-review collision hardening.
2. Begin `P1-014 Exam Engine`.
3. Run `P1-006`, `P1-007` and the one-course pilot when private inputs are supplied.
