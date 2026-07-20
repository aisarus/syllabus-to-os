# Lamdan — Current execution status

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 1ceca678359e1e0d5e6eb333300a8b34b1d5f1c2
baseline_pr: 78
active_phase: production-phase-0-stabilization
active_task: S3-002
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

Last updated: 2026-07-20

## Current milestone

**Production readiness Phase 0 — trustworthy service execution**

The verified runtime baseline is `main` through commit `1ceca678359e1e0d5e6eb333300a8b34b1d5f1c2` / PR #78.

**Active task:** `S3-002 request IDs, resource controls and idempotency`
**Active PR:** none

S3-002 must bound expensive AI operations without changing successful response contracts or the review-first draft model. Cancellation propagation remains S3-003.

## Current product state

Lamdan remains a late MVP / early closed alpha with source-linked materials, reviewed OCR/transcription drafts, Study Pack, Quiz Studio, Exam Engine, long-media backup/restore and an explicit durable workspace repository.

## Completed stabilization slices

- `S1-001` durable-before-publish persistence — PR #75.
- `S2-001` explicit `WorkspaceRepository` and import-order independence — PR #76.
- `S3-001` AI API inventory, shared Zod parsing and redacted error envelopes — PR #78.

## External milestone blockers

- `P1-005` reviewed OCR pipeline is implemented; live quality remains gated by `P1-006`.
- `P1-006` live OCR validation requires private/licensed Hebrew and mixed-content images plus a provider-enabled deployment.
- `P1-007` golden Hebrew quiz validation requires a legally usable complete source pack and human review.
- `P1-008` one-course closed pilot depends on P1-006 and P1-007.
- Licensed Hebrew/Russian lecture evaluation still requires real provider credentials, latency and cost evidence.

## Documentation authority

`TASKS.md` is the canonical executable ledger, `PLANS.md` records the active sequence, and this file records evidence and blockers. Their metadata is checked by `npm run verify:docs`.

## Next execution targets

**Active task:** `S3-002 request IDs, resource controls and idempotency`

1. Add a request ID to every AI API response and expose it in response headers.
2. Add bounded operation timeouts, concurrency slots and per-operation cost ceilings.
3. Retry only explicitly transient provider failures.
4. Add idempotency keys so an identical expensive request cannot charge or save twice.
5. Keep AbortSignal propagation and late-result rejection in `S3-003`.
6. Complete `S4-001` accessibility and executable pilot work after service stabilization.
7. Run `P1-006`, `P1-007` and `P1-008` when licensed inputs and a connected deployment are available.
