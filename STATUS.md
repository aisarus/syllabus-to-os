# Lamdan — Current execution status

Last updated: 2026-07-14

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live validation. Study Command Center, Lecture-to-Study-Pack, Concept Graph v1, per-question quiz evidence and Workspace backup v2 are implemented and verified. Reviewed concept extraction is the active delivery.

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

## Current implementation pass — Reviewed concept extraction

**Status:** implemented on `agent/reviewed-concept-extraction`; full CI and browser verification pending.

Delivered:

- source-grounded concept extraction API at `/api/ai/extract-concepts`;
- at most eight explicitly selected approved material chunks per request;
- prompt forbids model-memory facts, hidden citations and duplicate existing concepts;
- every AI candidate requires one or more exact allowed `sourceChunkIds`;
- uncited candidates are removed server-side before reaching the browser;
- unknown source ids are rejected and recorded in trust metadata;
- existing concept titles and aliases are supplied as a do-not-duplicate list;
- local parser for `Key terms` / `Ключевые термины` sections in saved Study Pack notes;
- Study Pack proposals retain only still-valid note-level source links and show an explicit coarse-citation warning;
- editable candidate title, description, aliases and source relationships;
- duplicate title/alias detection against the current course map;
- optional target topic assignment at acceptance time;
- candidates remain ephemeral until explicit selection and confirmation;
- accepted candidates create source-linked concepts only;
- accepting a candidate creates no evidence event and does not increase knowledge state;
- deterministic parser, citation, normalization and duplicate evaluations;
- dedicated Chromium proof for Study Pack proposal → review → acceptance → reload with zero evidence events;
- permanent trust contract and CI wiring pending completion.

Current boundaries:

- extraction proposes atomic concepts, not an automatic ontology or relationship graph;
- saved Study Packs only retain note-level source ids, so term-level links require human review;
- AI extraction needs a configured provider;
- rejected and abandoned candidates are not persisted;
- open-answer evidence and mistake repair remain a separate follow-up.

## Verification state

Pending on the current branch:

- reviewed concept extraction contract and deterministic evaluations;
- all existing repository contracts and eval suites;
- TypeScript;
- ESLint and formatting;
- production build;
- critical Chromium, question-evidence Chromium, workspace-backup Chromium and concept-extraction Chromium.

The branch must not merge until every gate passes.

## Existing validation blockers

### P1-006

Live OCR quality cannot be measured without four private/licensed photos and a reachable deployment with the AI provider configured.

### P1-007

Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.

### P1-008

The one-course closed pilot depends on P1-006 and P1-007. M1 remains unachieved until the complete script passes.

## Next execution targets

1. Verify and merge reviewed concept extraction.
2. Add open-answer evidence and mistake repair.
3. Begin `P1-014 Exam Engine` after the evidence foundation remains stable in real use.
4. Run `P1-006`, `P1-007` and the one-course pilot when private inputs are supplied.
