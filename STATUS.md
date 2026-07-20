# Lamdan — Current execution status

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 2af218a92622db2ce04337e9095c78e72782a456
baseline_pr: 81
active_phase: production-phase-0-stabilization
active_task: S3-003
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

Last updated: 2026-07-20

## Current milestone

**Production readiness Phase 0 — cancellable and trustworthy AI execution**

The verified runtime baseline is `main` through commit `2af218a92622db2ce04337e9095c78e72782a456` / PR #81.

**Active task:** `S3-003 real cancellation propagation and late-result rejection`  
**Active PR:** none

Lamdan now validates all AI inputs through one runtime boundary and applies process-local request IDs, operation budgets, transient-only retry and bounded idempotency to every AI route. S3-003 must make cancellation real across the complete request → controller → provider chain rather than merely hiding a late response.

## Completed stabilization slices

- `S1-001` durable-before-publish workspace persistence — PR #75.
- `S2-001` explicit `WorkspaceRepository` and import-order independence — PR #76.
- `S3-001` shared AI request validation and redacted error contracts — PR #78.
- `S3-002` bounded AI execution engine and route integration — PRs #80 and #81.

## Current product state

Lamdan remains a late MVP / early closed alpha with source-linked materials, reviewed OCR and transcription drafts, Study Pack, Quiz Studio, Exam Engine, long-media backup/restore and explicit durable workspace persistence. Generated academic content remains draft-only until explicit Apply/Save.

## External milestone blockers

- `P1-005` reviewed OCR pipeline is implemented; live quality remains gated by `P1-006`.
- `P1-006` live OCR validation requires private/licensed Hebrew and mixed-content images plus a connected provider-enabled deployment.
- `P1-007` golden Hebrew quiz validation requires a legally usable complete source pack and human review.
- `P1-008` one-course closed pilot depends on P1-006 and P1-007.
- Licensed Hebrew/Russian lecture evaluation still requires real provider credentials, reviewed references, latency and cost evidence.

## Documentation authority

`TASKS.md` is the canonical executable ledger, `PLANS.md` records the active sequence, and this file records evidence and blockers. Their shared metadata is checked by `npm run verify:docs`.

## Next execution targets

**Active task:** `S3-003 real cancellation propagation and late-result rejection`

1. Propagate one AbortSignal from every AI request through the execution controller to the provider adapter.
2. Abort provider work when the client disconnects, the user cancels or the operation timeout expires.
3. Reject late completion after abort and prevent it from entering idempotency cache or any persisted draft path.
4. Preserve retry semantics only before cancellation and never retry an aborted operation.
5. Add deterministic cancellation and late-result regressions for generic JSON, syllabus and transcription paths.
6. Complete `S4-001` accessibility and executable pilot work after service stabilization.
7. Run `P1-006`, `P1-007` and `P1-008` when licensed inputs and a connected deployment are available.
