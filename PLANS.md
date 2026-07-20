# Lamdan implementation plans

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 2af218a92622db2ce04337e9095c78e72782a456
baseline_pr: 81
active_phase: production-phase-0-stabilization
active_task: S3-003
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

This file records the active implementation sequence. Product intent remains in `ROADMAP.md`; acceptance lives in `TASKS.md`; evidence and blockers live in `STATUS.md`.

## Active plan — Production readiness Phase 0

**Baseline:** `main` at `2af218a92622db2ce04337e9095c78e72782a456` / PR #81  
**Active task:** `S3-003 real cancellation propagation and late-result rejection`  
**Active PR:** none

### Sequence

1. Inventory provider adapters and record which already accept an AbortSignal.
2. Compose client cancellation with operation timeout in the execution controller.
3. Propagate the composed signal through generic JSON handlers, syllabus and transcription.
4. Stop retries immediately when the signal aborts.
5. Reject late completion and keep aborted results out of the idempotency cache.
6. Preserve request IDs and expose a stable cancellation error response.
7. Add deterministic cancellation and late-result regressions.
8. Run all affected AI/OCR/syllabus/transcription contracts and available static/type/build gates.

### Explicit exclusions

- no Redis or distributed job cancellation;
- no new background queue;
- no authentication/cloud-backend redesign;
- no broad UI redesign or new AI feature;
- no IndexedDB migration.

### Acceptance gate

- cancellation reaches every supported provider adapter;
- timed-out work is actively aborted;
- aborted operations are not retried, cached or published;
- late completion cannot turn into success;
- normal retry after settled cancellation remains possible;
- all applicable local gates are green on one head.

## Completed stabilization slices

1. `S1-001` — durable-before-publish persistence, PR #75.
2. `S2-001` — explicit workspace repository, PR #76.
3. `S3-001` — shared AI validation/error contracts, PR #78.
4. `S3-002` — bounded execution and route integration, PRs #80–#81.

## Subsequent Phase 0 slice

1. `S4-001` — accessibility baseline and executable pilot harness.

## External validation plan — P1-005 to P1-008

`P1-005` is implemented. `P1-006`, `P1-007` and `P1-008` remain externally blocked by licensed inputs, human review and a connected provider-enabled deployment.
