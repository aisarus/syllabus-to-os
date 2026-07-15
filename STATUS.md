# Lamdan — Current execution status

Last updated: 2026-07-15

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live OCR and quiz validation. Concept evidence, reviewed extraction, open-answer repair, collision hardening and Exam Engine v1 are merged. Durable whole-lecture audio/video intake is the active implementation pass.

## Completed task state

- `P0-001` through `P0-020` — complete and verified.
- `P0-021 Durable image intake and OCR review` — complete and verified.
- `P0-022A Image Preprocessing Workspace` — complete and verified; PR #28.
- `P0-022B OCR Region Overlay and Sync` — complete and verified; PR #29.
- `P0-022C Full Visual Backup and Restore` — complete and verified; PR #30.
- `P0-023 Quizlet-style cards and golden generated quizzes` — complete and verified.
- `P1-001 Multi-page image materials` — complete and verified; PR #31.
- `P1-002 Golden quiz quality evaluation` — complete and verified; PR #32.
- `P1-003 Critical browser end-to-end coverage` — complete and verified; PR #33.
- `P1-004 Add local-first global search v2` — complete and verified; PR #34.
- `P1-005 Store persistence and source-integrity hardening` — complete and verified; PR #35.
- `P1-011 Study Command Center v1` — complete and verified; PR #36.
- `P1-012 Lecture-to-Study-Pack` — complete and verified; PR #37.
- `P1-013 Concept graph and evidence model v1` — complete and verified; PR #38.
- `P1-013A per-question quiz evidence` — complete and verified; PR #39.
- `P1-013B Workspace backup v2` — complete and verified; PR #41.
- `P1-013C Reviewed concept extraction` — complete and verified; PR #42.
- `P1-013D Open-answer evidence and mistake repair` — complete and verified; PR #43.
- `P1-013E Edited-batch concept collision guard` — complete and verified; PR #44.
- `P1-014A Frozen source-grounded Exam Engine v1` — complete and verified; PR #45.

## Current implementation pass — Durable whole-lecture audio/video intake

**Status:** implemented on `agent/long-lecture-media`; full CI pending.

Delivered:

- separate `/app/lecture-media` route and primary navigation item;
- audio/video selection by MIME or common extension;
- explicit 4 GB local per-file boundary;
- sequential 8 MB IndexedDB chunks instead of reading the complete recording into memory;
- browser quota check and best-effort persistent-storage request before upload;
- fresh staging `uploadId` for every new or replacement recording;
- active manifest changes only after every chunk is stored;
- cancellation/error cleanup while an older complete recording remains intact;
- navigation failure cannot delete an already completed recording;
- orphan cleanup re-reads the latest hydrated workspace at execution time instead of using a stale first-render snapshot;
- SHA-256 per media chunk and explicit integrity verification;
- local audio/video player reconstructed only after an explicit user action;
- SRT, WebVTT and plain-text transcript import;
- editable ten-minute transcript blocks with timecodes and optional speaker labels;
- `empty`, `draft` and `approved` transcript states;
- only approved non-empty segments become normal Lamdan source chunks;
- source-integrity-aware transcript apply and normal Study Pack compatibility;
- orphan cleanup, local storage statistics and delete-recordings-only control;
- explicit statement that raw multi-gigabyte media and editable transcript drafts are not yet in Workspace ZIP v2;
- deterministic evaluation suite and a real 18 MB / three-chunk Chromium proof;
- hardened browser proof validates core material and all three IndexedDB chunks before opening the detail route;
- repository-wide Prettier baseline restored so canonical `eslint .` can detect semantic errors instead of stale formatting noise;
- legacy `any` and empty compatibility-interface lint blockers replaced with typed equivalents;
- final long-media browser runner and workflow pass the scoped Prettier and semantic lint check.

Current boundaries:

- choosing or storing a recording never sends it to external AI;
- automatic transcription is not included in this first slice;
- playback after reload reconstructs a Blob and can require significant memory for very large video;
- raw media and editable transcript drafts require a future streaming backup format;
- the original audio/video file must be retained separately for now;
- applied transcript chunks are backed up as ordinary core source data.

## Verification state

Pending on the current branch:

- all repository contracts and deterministic evaluations;
- long-media contract and deterministic evaluations;
- TypeScript;
- ESLint and formatting;
- production build;
- critical browser end-to-end and the other existing browser regression gates;
- long-media Chromium: 18 MB upload → three IndexedDB chunks → SHA verification → SRT import → two approved source chunks → reload.

The branch must not merge until every applicable gate passes.

## Existing validation blockers

### P1-006

Live OCR quality cannot be measured without four private/licensed photos and a reachable deployment with the AI provider configured.

### P1-007

Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.

### P1-008

The one-course closed pilot depends on P1-006 and P1-007. M1 remains unachieved until the complete script passes.

## Next execution targets

1. Verify and merge durable whole-lecture audio/video intake.
2. Build reviewed, cancellable automatic transcription as a separate `P1-010B` slice with explicit provider disclosure.
3. Integrate Exam Engine and long-media metadata into the next complete streaming backup format.
4. Run `P1-006`, `P1-007` and the one-course pilot when private inputs are supplied.
