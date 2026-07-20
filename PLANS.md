# Lamdan implementation plans

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 1ceca678359e1e0d5e6eb333300a8b34b1d5f1c2
baseline_pr: 78
active_phase: production-phase-0-stabilization
active_task: S3-002
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

This file records the active implementation sequence. Product intent remains in `ROADMAP.md`; acceptance lives in `TASKS.md`; evidence and blockers live in `STATUS.md`.

## Active plan — Production readiness Phase 0

**Baseline:** `main` at `1ceca678359e1e0d5e6eb333300a8b34b1d5f1c2` / PR #78
**Active task:** `S3-002 request IDs, resource controls and idempotency`
**Active PR:** none

### Sequence

1. Add one server-only execution policy registry keyed by AI operation.
2. Generate or validate a request ID and return it in every shared response header.
3. Acquire an operation-specific concurrency slot before provider invocation.
4. Enforce timeout and estimated-cost ceilings without changing successful payloads.
5. Retry only classified transient failures with bounded attempts/backoff.
6. Deduplicate concurrent and completed requests by validated idempotency key.
7. Add deterministic contracts for timeout, concurrency, retry and duplicate suppression.
8. Run affected AI/OCR/syllabus/transcription contracts, typecheck, lint and build.

### Explicit exclusions

- no Redis, queue service or distributed limiter;
- no complete cancellation UI in this slice;
- no authentication/cloud-backend redesign;
- no new AI feature;
- no IndexedDB migration.

### Acceptance gate

- duplicate expensive requests invoke the provider once;
- operation limits reject before provider invocation;
- timeouts return stable safe errors and suppress late completion;
- retries occur only for transient failures;
- request IDs are stable and observable;
- all relevant local gates are green on one head.

## Completed stabilization slices

1. `S1-001` — durable-before-publish persistence, PR #75.
2. `S2-001` — explicit workspace repository, PR #76.
3. `S3-001` — shared AI validation/error contracts, PR #78.

## Subsequent Phase 0 slices

1. `S3-003` — full cancellation propagation and late-result rejection.
2. `S4-001` — accessibility baseline and executable pilot harness.

## External validation plan — P1-005 to P1-008

`P1-005` is implemented. `P1-006`, `P1-007` and `P1-008` remain externally blocked by licensed inputs, human review and a connected provider-enabled deployment.
