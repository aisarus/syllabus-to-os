# Lamdan — Current execution status

Last updated: 2026-07-13

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live validation. The first M2 layer, Study Command Center, is merged; the next vertical layer, Lecture-to-Study-Pack, is implemented in the current branch and under verification.

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

## Current implementation pass

### P1-012 — Lecture-to-Study-Pack

**Status:** implemented on `agent/lecture-study-pack`; full CI, review and browser verification pending.

Delivered:

- primary “Prepare me from this lecture” action on material detail;
- selected approved source chunks only;
- one combined editable draft rather than disconnected generation dialogs;
- concise orientation and realistic total duration;
- ordered orient/learn/recall/practice/repair steps;
- clean structured note;
- source-linked key terminology;
- deduplicated atomic flashcards;
- diagnostic questions with four unique options, one answer and grounded explanations;
- explicit unclear areas and `notFoundInSources` instead of model-memory gap filling;
- unknown source IDs are rejected and uncited items are counted;
- user review and correction before any save;
- approved pack persists as normal first-class note, flashcards and quiz entities;
- source references remain attached to each saved item;
- no claim that finishing the pack proves mastery;
- deterministic helper evaluations and a permanent trust contract;
- package, local check and GitHub Actions wiring.

Current v1 boundaries:

- one material at a time;
- at most eight selected source chunks / 20,000 characters;
- no persistent dedicated `StudyPack` entity yet;
- no section-level AI regeneration yet;
- no completion evidence or first-step Study Cockpit yet;
- live provider quality still requires real Hebrew course material.

### Academic Autopilot roadmap

`ROADMAP.md`, `TASKS.md` and `PLANS.md` define the connected sequence:

- `P1-013` concept graph and evidence model;
- `P1-014` Exam Engine;
- `P1-015` Assignment Copilot;
- `P1-016` Lecture Mode;
- `P1-017` Ask My Course;
- `P1-018` intelligent calendar and workload forecast;
- `P1-019` personal explanation and accessibility layer.

## Verification state

Pending on the current branch:

- Study Pack contract and deterministic evaluations;
- all existing documentation, source-integrity and OCR contracts;
- TypeScript;
- ESLint and formatting;
- production build and generated route tree;
- critical browser end-to-end execution;
- review of save behavior and mobile-width modal usability.

The branch must not merge until the full quality workflow passes.

## Existing validation blockers

### P1-006

Live OCR quality cannot be measured without four private/licensed photos and a reachable deployment with the AI provider configured.

### P1-007

Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.

### P1-008

The one-course closed pilot depends on P1-006 and P1-007. M1 remains unachieved until the complete script passes.

## Next execution targets

1. Verify `P1-012` in CI and fix every failure.
2. Review Study Pack trust, save and mobile behavior.
3. Merge PR #37 only after all repository gates pass.
4. Run `P1-006` and `P1-007` when private inputs are supplied.
5. Execute `P1-008` and fix pilot blockers.
6. Start `P1-013 Concept graph and evidence model` after Study Pack is stable.
