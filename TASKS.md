# Lamdan — P0 Implementation Tasks and Production Readiness Ledger

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 1ceca678359e1e0d5e6eb333300a8b34b1d5f1c2
baseline_pr: 78
active_phase: production-phase-0-stabilization
active_task: S3-002
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

This is the canonical executable task ledger. Product intent lives in `ROADMAP.md`; active sequencing lives in `PLANS.md`; evidence and blockers live in `STATUS.md`.

## Status legend

- `[ ]` not started
- `[~]` in progress
- `[x]` complete and verified
- `[!]` externally blocked

## Global definition of done

A task is complete only when applicable contracts/evals, typecheck, lint and build pass on the same head; skipped environment checks remain blockers rather than successes.

# Production readiness execution

## S1-001 — Durable-before-publish core persistence

- **Status:** [x]
- **Merged:** PR #75

## S2-001 — Explicit WorkspaceRepository and import-order independence

- **Status:** [x]
- **Merged:** PR #76

## S3-001 — AI API inventory and shared validation/error contracts

- **Status:** [x]
- **Merged:** PR #78
- **Evidence:** all 16 routes inventoried; 14 POST routes use shared runtime parsing; malformed and oversized requests fail before provider invocation; internal/provider errors are redacted; success responses remain compatible.

## S3-002 — Request IDs, resource controls and idempotency

- **Status:** [ ]
- **Priority:** active P0 production blocker
- **Depends on:** S3-001
- **Active task:** `S3-002`
- **Current PR:** none

### Problem

Validated requests can still consume provider capacity without a common execution budget. The service lacks stable request IDs, bounded concurrency, operation timeouts, explicit transient retry rules, cost ceilings and duplicate-request protection.

### Scope

- attach a stable request ID to every shared AI response and header;
- define per-operation timeout, concurrency and estimated-cost budgets;
- retry only classified transient provider failures with bounded backoff;
- reject work when a local process-level rate or concurrency budget is exhausted;
- accept validated idempotency keys and reuse the first completed result;
- prevent concurrent duplicate execution for the same idempotency key;
- add deterministic clocks/providers for tests without introducing Redis or another service.

### Acceptance criteria

- every shared AI response includes the same request ID in body/error metadata or response header;
- timed-out work returns a stable error and cannot publish a late result;
- concurrency above the configured operation limit is rejected before provider invocation;
- non-transient errors are never retried;
- a repeated idempotency key invokes the provider once and returns the cached result;
- failed requests do not poison an idempotency key permanently;
- relevant contracts/evals, `npm run typecheck`, `npm run lint` and `npm run build` pass on one head.

### Explicit exclusions

- distributed rate limiting or Redis;
- cross-instance durable idempotency before the backend phase;
- complete UI cancellation propagation, reserved for S3-003;
- authentication/backend redesign;
- new AI product features.

## Queued stabilization tasks

1. `S3-003` — real AbortSignal propagation and late-result rejection across all provider jobs.
2. `S4-001` — accessibility baseline and executable one-course pilot harness.
3. `D1-001` — versioned schemas and IndexedDB migration only after stabilization is green.

# External evidence gates

## P1-005 — Reviewed OCR pipeline

- **Status:** [x] implementation complete; live quality is separate.

## P1-006 — Live OCR validation

- **Status:** [!]
- **Blocked by:** licensed images and a provider-enabled deployment.

## P1-007 — Golden Hebrew quiz validation

- **Status:** [!]
- **Blocked by:** a legally usable source pack and human review.

## P1-008 — One-course closed pilot

- **Status:** [!]
- **Depends on:** P1-006 and P1-007.

# Current execution order

**Active task:** `S3-002 request IDs, resource controls and idempotency`
**Active PR:** none

1. Complete S3-002.
2. Complete S3-003.
3. Complete S4-001.
4. Begin versioned local schemas and IndexedDB only after stabilization is green.
