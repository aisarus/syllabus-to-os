# Lamdan implementation plans

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: ed11ca59c0c9a0ab8029822e5d283656536e4442
baseline_pr: 85
active_phase: production-phase-0-stabilization
active_task: S4-001
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

This file records the active implementation sequence. Product intent remains in `ROADMAP.md`; acceptance lives in `TASKS.md`; evidence and blockers live in `STATUS.md`.

## Active plan — Production readiness Phase 0

**Baseline:** `main` at `ed11ca59c0c9a0ab8029822e5d283656536e4442` / PR #85  
**Active task:** `S4-001 accessibility baseline and executable one-course pilot harness`  
**Active PR:** none

### Sequence

1. Inventory the primary shell, overlays and study surfaces for keyboard, focus and directionality behavior.
2. Fix the smallest confirmed blockers first: missing labels, invisible focus, incorrect `dir`, broken Escape or focus restoration.
3. Add structural contracts that reject regression in core navigation and modal semantics.
4. Run targeted browser checks for keyboard-only shell navigation and representative dialogs when Chromium is available.
5. Rewrite `PILOT.md` as a reproducible harness with exact setup, expected results and evidence storage.
6. Separate deterministic acceptance from P1-006/P1-007/provider-dependent evidence.
7. Close S4-001 only when accessibility evidence and the harness are both reviewable.

### Explicit exclusions

- no broad redesign;
- no new AI feature;
- no declaration that P1-008 passed;
- no IndexedDB or backend migration;
- no replacement of real licensed validation with mocks.

### Acceptance gate

- core shell and study actions work keyboard-only;
- focus is visible, trapped where appropriate and restored after close;
- Escape behavior is predictable and non-destructive;
- mixed RTL/LTR surfaces are readable;
- tested surfaces have no critical automated accessibility violations;
- pilot setup, expected results and evidence paths are executable;
- all unavailable live evidence remains explicitly blocked.

## Completed stabilization slices

1. `S1-001` — durable-before-publish persistence, PR #75.
2. `S2-001` — explicit workspace repository, PR #76.
3. `S3-001` — shared AI validation/error contracts, PR #78.
4. `S3-002` — bounded execution and route integration, PRs #80–#81.
5. `S3-003` — provider cancellation and late-result rejection, PRs #83 and #85.

## Subsequent data slice

1. `D1-001` — versioned local schemas and IndexedDB migration.

## External validation plan — P1-005 to P1-008

`P1-005` is implemented. `P1-006`, `P1-007` and `P1-008` remain externally blocked by licensed inputs, human review and a connected provider-enabled deployment.
