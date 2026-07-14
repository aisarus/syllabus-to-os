# Lamdan — Current execution status

Last updated: 2026-07-14

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live validation. Study Command Center, Lecture-to-Study-Pack, Concept Graph v1 and per-question quiz evidence are implemented and verified.

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
- `P1-011 Study Command Center v1` — complete and verified; PR #36 full CI and critical browser end-to-end passed and merged.
- `P1-012 Lecture-to-Study-Pack` — complete and verified; PR #37 full CI and critical browser end-to-end passed and merged.
- `P1-013 Concept graph and evidence model v1` — complete and verified; PR #38 full CI, CodeRabbit and critical browser end-to-end passed and merged.
- `P1-013A Per-question quiz evidence` — complete and verified; PR #39 full CI, critical Chromium and dedicated reload/persistence Chromium proof passed.

## P1-013A delivered state

- dedicated local-first `lamdan.quiz-attempt-details.v1` companion store;
- immutable snapshot for every question in a new attempt: prompt, selected/correct indexes and option text, correctness and source chunk ids;
- validation rejects incomplete or invalid attempts before persistence;
- answer-detail persistence is verified before the core aggregate attempt is created;
- core `lamdan.data.v1` schema remains compatible and historical aggregate attempts remain unchanged;
- main quiz route uses an evidence-aware runner;
- legacy Practice/Exam launch controls inside the editor are hidden and blocked through event capture;
- question editing remains available without exposing aggregate-only new attempts;
- detailed linked answers generate objective `recognition` success/failure evidence;
- incorrect answers default to `unclassified`, never inferred as confusion or carelessness;
- old aggregate attempts without snapshots remain neutral `assessment/mixed` context;
- aggregate context is removed when a detailed snapshot exists for the same attempt;
- deleting or unlinking a quiz question repairs question-level concept evidence;
- editing a question later does not rewrite historical answer snapshots;
- deterministic evaluations and permanent trust contracts;
- dedicated Chromium flow verifies aggregate attempt, immutable detail snapshot, concept event and reload without duplication.

Current boundaries:

- attempt details are not yet included in the full visual ZIP backup;
- old attempts cannot be retroactively reconstructed;
- open-answer and oral-response evidence remain unimplemented;
- concept extraction remains manual;
- no mastery percentage, score prediction or exam-readiness number exists.

## Verification state

PR #39 passed:

- all existing repository contracts and deterministic eval suites;
- per-question evidence contract and deterministic evaluations;
- TypeScript;
- ESLint and formatting;
- production build and generated route tree;
- critical Chromium end-to-end execution;
- dedicated question-evidence Chromium flow with reload and duplicate assertion.

## Existing validation blockers

### P1-006

Live OCR quality cannot be measured without four private/licensed photos and a reachable deployment with the AI provider configured.

### P1-007

Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.

### P1-008

The one-course closed pilot depends on P1-006 and P1-007. M1 remains unachieved until the complete script passes.

## Next execution targets

1. Integrate attempt-detail and concept data into full visual ZIP backup.
2. Add reviewed concept extraction from Study Pack/source chunks.
3. Add open-answer evidence and mistake repair.
4. Begin `P1-014 Exam Engine` after the evidence foundation remains stable in real use.
5. Run `P1-006`, `P1-007` and the one-course pilot when private inputs are supplied.
