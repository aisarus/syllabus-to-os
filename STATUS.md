# Lamdan — Current execution status

Last updated: 2026-07-14

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live validation. Study Command Center and Lecture-to-Study-Pack are merged; the current implementation pass is the first honest Concept Graph and Evidence Model vertical slice.

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

## Current implementation pass

### P1-013 — Concept graph and evidence model v1

**Status:** implemented on `agent/concept-evidence-v1`; full CI and browser verification pending.

Delivered:

- separate local-first `lamdan.concept-evidence.v1` layer without rewriting `lamdan.data.v1`;
- explicit migration from missing or malformed concept data to a normalized empty/safe layer;
- course concepts linked manually to topics, approved source chunks, flashcards and quiz questions;
- knowledge states `unseen`, `covered`, `fragile`, `weak` and `strong`;
- strong evidence requires at least four successful events, two distinct days and two evidence kinds;
- one lucky answer or one flashcard rating cannot create strong state;
- flashcard review outcomes create recall success/failure events only for explicitly linked concepts;
- aggregate quiz attempts appear as neutral `mixed` assessment context and never raise concept state;
- explicit explanation/application checks for evidence that the current app cannot measure automatically;
- editable mistake taxonomy: retrieval, confusion, application, careless and unclassified;
- forgetting-risk label from time since latest successful scored evidence;
- inspectable and removable evidence history with immediate recalculation;
- reconciliation removes dangling course/topic/chunk/card/question relationships;
- deleting linked flashcard practice removes its dangling evidence;
- visible course-level concept JSON export/import;
- RU/EN Course Workspace UI using the Academic Content Workspace design system;
- deterministic evaluations and a permanent trust contract.

Current v1 boundaries:

- concept extraction is manual; AI extraction review is not implemented;
- existing `QuizAttempt` records do not contain per-question answers, so quiz evidence remains neutral context;
- open-answer and oral evidence are not implemented;
- concept export is separate from the full visual ZIP backup;
- no mastery percentage, score prediction or exam-readiness number exists.

## Verification state

Pending on the current branch:

- concept evidence contract and deterministic evaluations;
- all existing documentation, source-integrity, Study Pack and OCR contracts;
- TypeScript;
- ESLint and formatting;
- production build and generated route tree;
- critical browser end-to-end execution;
- browser review of concept creation, linking, evidence removal and responsive layout.

The branch must not merge until the full quality workflow passes.

## Existing validation blockers

### P1-006

Live OCR quality cannot be measured without four private/licensed photos and a reachable deployment with the AI provider configured.

### P1-007

Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.

### P1-008

The one-course closed pilot depends on P1-006 and P1-007. M1 remains unachieved until the complete script passes.

## Next execution targets

1. Verify `P1-013` in CI and fix every failure.
2. Inspect concept creation, linking, evidence capture/removal and mobile layout in Chromium.
3. Merge only after all repository gates pass.
4. Persist per-question quiz answer evidence without changing historical aggregate attempts.
5. Add reviewed concept extraction from Study Pack/source chunks.
6. Integrate concept data into full visual ZIP backup.
7. Begin `P1-014 Exam Engine` only after the evidence foundation is stable.
