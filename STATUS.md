# Lamdan — Current execution status

Last updated: 2026-07-14

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live validation. Study Command Center, Lecture-to-Study-Pack, Concept Graph v1, per-question quiz evidence, Workspace backup v2 and Reviewed concept extraction are implemented and verified. Open-answer evidence and mistake repair is the active delivery.

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

## Current implementation pass — Open-answer evidence and mistake repair

**Status:** implemented on `agent/open-answer-evidence`; full CI and browser verification pending.

Delivered:

- source-grounded open-answer review API at `/api/ai/review-open-answer`;
- stored exact prompt, full response, evidence kind, outcome, score, review summary and reviewed source chunks;
- explanation and application evidence modes;
- strict AI prompt forbids model memory and outside knowledge;
- insufficient or uncited sources cannot produce a grounded success suggestion;
- AI output remains a suggestion and is never saved automatically;
- mandatory human confirmation of outcome, score, mistake type and source chunks;
- human-only reviews remain secondary evidence;
- source-grounded `ai_human` reviews may count as non-manual only after explicit human confirmation;
- linked mistake repair through `repairOfEvidenceId`;
- repair creates a new event and preserves the original failure;
- orphan or invalid repair links are removed during reconciliation;
- deleting or unlinking reviewed source chunks removes the affected open-answer evidence;
- inspectable and removable open-answer history;
- deterministic review, objective-evidence, source-repair and orphan-link evaluations;
- dedicated Chromium flow for failure → repair → reload with both events preserved.

Current boundaries:

- live AI review quality still requires a configured provider and licensed real source pack;
- human-only review is intentionally secondary and cannot satisfy the objective-success requirement alone;
- oral-response capture is not implemented;
- manually edited cross-candidate alias/title collisions remain a separate small hardening follow-up;
- no automatic score prediction or exam-readiness percentage is introduced.

## Verification state

Pending on the current branch:

- open-answer evidence and repair contract and deterministic evaluations;
- all existing repository contracts and eval suites;
- TypeScript;
- ESLint and formatting;
- production build;
- critical browser end-to-end Chromium;
- question-evidence Chromium;
- workspace-backup Chromium;
- reviewed concept extraction Chromium;
- open-answer failure/repair/reload Chromium.

The branch must not merge until every gate passes.

## Existing validation blockers

### P1-006

Live OCR quality cannot be measured without four private/licensed photos and a reachable deployment with the AI provider configured.

### P1-007

Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.

### P1-008

The one-course closed pilot depends on P1-006 and P1-007. M1 remains unachieved until the complete script passes.

## Next execution targets

1. Verify and merge open-answer evidence and mistake repair.
2. Add final edited-batch alias collision hardening.
3. Begin `P1-014 Exam Engine` after the evidence foundation remains stable in real use.
4. Run `P1-006`, `P1-007` and the one-course pilot when private inputs are supplied.
