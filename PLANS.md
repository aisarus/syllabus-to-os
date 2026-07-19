# Lamdan implementation plans

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 716f8ba4c7430f30635fe2b6934b562ae2ec6abf
baseline_pr: 76
active_phase: production-phase-0-stabilization
active_task: S3-001
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

This file records the active implementation plan. Product intent remains in `ROADMAP.md`; canonical task status and acceptance criteria live in `TASKS.md`; evidence and blockers live in `STATUS.md`.

## Active plan — Production readiness Phase 0

**Baseline:** `main` at `716f8ba4c7430f30635fe2b6934b562ae2ec6abf` / PR #76
**Active task:** `S3-001 AI API inventory and shared validation/error contracts`
**Active PR:** none

### Scope of S3-001

1. Enumerate the real `src/routes/api/ai/*` tree and record each request, response and provider boundary.
2. Introduce shared Zod parsing helpers for JSON and form-data metadata.
3. Introduce a stable redacted JSON error envelope and HTTP status mapping.
4. Migrate endpoints in bounded groups without changing successful response shapes or draft-only trust boundaries.
5. Add negative contracts proving invalid inputs fail before provider invocation and internal failures expose no secret, stack or raw source content.

### Explicit exclusions

- no request IDs, tracing, rate/concurrency/cost limits or idempotency in this slice;
- no AbortSignal/cancellation work;
- no authentication or cloud-backend redesign;
- no new AI tool or student-facing feature;
- no IndexedDB migration.

### Acceptance gate

The task is complete only when the following evidence is green on the same local head:

- endpoint inventory matches the real route tree;
- migrated endpoints reject malformed input deterministically before provider invocation;
- error responses use the shared redacted envelope;
- successful response shapes and draft-only behavior remain compatible;
- relevant API contracts and deterministic evals;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`.

## Completed stabilization slices

1. `S1-001` — durable-before-publish persistence, merged in PR #75.
2. `S2-001` — explicit `WorkspaceRepository` and removal of import-order method mutation, merged in PR #76.

## Subsequent Phase 0 slices

1. `S3-002` — request IDs, payload/time/concurrency/rate/cost limits and idempotency.
2. `S3-003` — real cancellation propagation and late-result rejection.
3. `S4-001` — accessibility baseline and executable one-course pilot harness.

## External validation plan — P1-006 to P1-008

**Status:** externally blocked; deterministic infrastructure exists, live evidence does not.

1. Place four private/licensed images in `private-ocr-assets/`.
2. Run `npm run eval:ocr:live` against a connected Lamdan deployment.
3. Classify and fix live OCR failure categories.
4. Generate one golden quiz from a complete Hebrew source pack and review every question.
5. Promote an approved quiz candidate into permanent fixtures.
6. Run the complete one-course pilot in `PILOT.md`.
7. Fix every critical data-loss, provenance or mobile blocker before declaring M1.

## Verified baseline through PR #76

- long-media intake, reviewed automatic transcription, resumable ranges, local extraction, streaming backup and staged restore — PRs #46, #47, #48, #52, #53 and #54;
- private Hebrew/Russian lecture quality harness — PR #57;
- bounded exam planning — PR #58;
- navigation, focused dashboard, course/material hierarchy and unified study outputs — PRs #61–#64;
- source-reference deletion integrity and multi-page replacement browser proof — PRs #65–#66;
- Study Pack continuation, quiz mistake repair and Exam Engine result/repair flow — PRs #67–#72;
- durable-before-publish persistence and explicit repository/import-order boundaries — PRs #75–#76.

Open historical PRs that predate this baseline are not active implementation sources. Draft PR #73 is also excluded until independently reviewed and merged.
