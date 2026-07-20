# Lamdan — P0 Implementation Tasks and Production Readiness Ledger

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 2af218a92622db2ce04337e9095c78e72782a456
baseline_pr: 81
active_phase: production-phase-0-stabilization
active_task: S3-003
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

A task is complete only when its applicable contracts/evals pass on the same head, approved data and source relationships remain valid, generated output stays draft-only until explicit Apply/Save, and skipped environment-dependent checks remain named blockers rather than successes.

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

## S3-002 — Request IDs, resource controls and idempotency

- **Status:** [x]
- **Merged:** PRs #80 and #81
- **Evidence:** all 14 POST routes use bounded execution; both status routes expose request IDs; concurrent duplicates invoke the provider once; timeout, rate, concurrency, cost, retry and replay behavior have deterministic regressions.

## S3-003 — Real cancellation propagation and late-result rejection

- **Status:** [ ]
- **Priority:** active P0 production blocker
- **Depends on:** S3-002
- **Active task:** `S3-003`
- **Current PR:** none

### Problem

Timeout currently bounds the HTTP response, but not every provider adapter is proven to stop its underlying work. A cancelled or timed-out operation must not continue consuming provider capacity, become eligible for retry, enter the idempotency cache or publish a late draft.

### Scope

- create one composed AbortSignal for client cancellation and operation timeout;
- pass that signal through generic JSON routes, syllabus, OCR and transcription provider adapters;
- classify abort separately from transient provider failure;
- never retry after cancellation;
- reject and discard completion produced after abort;
- preserve existing review-first Apply/Save boundaries;
- add deterministic abort-before-provider, abort-during-provider and late-completion regressions.

### Acceptance criteria

- provider work observes abort for every supported AI operation;
- timeout aborts the provider operation rather than only returning a 504;
- a cancelled operation is not retried or cached;
- a late provider result cannot become an HTTP success or saved draft;
- a second request after completed cancellation can run normally;
- relevant contracts/evals and available type/lint/build gates pass on one head.

### Explicit exclusions

- distributed job cancellation across multiple server instances;
- a new background queue or Redis;
- broad UI redesign;
- authentication/backend redesign;
- new AI product features.

## Queued stabilization tasks

1. `S4-001` — accessibility baseline and executable one-course pilot harness.
2. `D1-001` — versioned local schemas and IndexedDB migration after stabilization is green.

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

**Active task:** `S3-003 real cancellation propagation and late-result rejection`  
**Active PR:** none

1. Complete S3-003.
2. Complete S4-001.
3. Begin versioned schemas and IndexedDB only after stabilization is green.
