# Lamdan — Current execution status

Last updated: 2026-07-14

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live validation. Study Command Center, Lecture-to-Study-Pack, Concept Graph v1 and per-question quiz evidence are implemented and verified. Workspace backup v2 is the active hardening pass.

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
- `P1-013A Per-question quiz evidence` — complete and verified; PR #39 merged after full CI and dedicated Chromium persistence proof.

## Workspace backup v2

**Status:** implemented on `agent/workspace-backup-v2-clean`; final CI and browser validation are in progress.

Delivered:

- new `lamdan-workspace-backup` format version 2;
- nested verified visual backup v1 payload;
- checksummed concept-evidence and quiz-attempt-detail payloads;
- strict path, kind, size, SHA-256, unexpected-file and expansion-limit validation;
- backward-compatible legacy visual ZIP import;
- explicit legacy merge/replace evidence behavior;
- preview counts for concepts, evidence events, detailed attempts and immutable answer snapshots;
- conflict-safe merge that keeps current duplicate IDs;
- no evidence mixing into a conflicting concept;
- reconciliation against the actual resulting core workspace;
- rollback across core localStorage, visual IndexedDB, concept evidence and attempt details;
- Data Management and Clear All cover all four layers;
- deterministic roundtrip, tamper, legacy and conflict evaluations;
- dedicated browser flow for replace, checksum rejection, forced write failure, rollback and reload.

Current boundaries:

- the outer v2 archive intentionally nests the mature visual v1 archive;
- internal concept and attempt-detail schemas remain version 1;
- legacy archives cannot recreate evidence they never contained;
- cloud sync and server storage remain out of scope.

## Verification state

Pending on PR #41:

- all repository contracts and deterministic evals;
- TypeScript;
- ESLint and formatting;
- production build;
- critical browser end-to-end Chromium execution;
- question-evidence Chromium;
- workspace-backup replace/tamper/rollback Chromium.

The branch must not merge until every gate passes.

## Existing validation blockers

### P1-006

Live OCR quality cannot be measured without four private/licensed photos and a reachable deployment with the AI provider configured.

### P1-007

Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.

### P1-008

The one-course closed pilot depends on P1-006 and P1-007. M1 remains unachieved until the complete script passes.

## Next execution targets

1. Verify and merge Workspace backup v2.
2. Add reviewed concept extraction from Study Pack/source chunks.
3. Add open-answer evidence and mistake repair.
4. Begin `P1-014 Exam Engine` after the evidence foundation remains stable in real use.
5. Run `P1-006`, `P1-007` and the one-course pilot when private inputs are supplied.
