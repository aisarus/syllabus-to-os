# Lamdan implementation plans

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 92108e1c8041f99544c1983ff1d24d6687645a66
baseline_pr: 72
active_phase: production-phase-0-stabilization
active_task: S1-001
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

This file records the active implementation plan. Product intent remains in `ROADMAP.md`; canonical task status and acceptance criteria live in `TASKS.md`; evidence and blockers live in `STATUS.md`.

## Active plan — Production readiness Phase 0

**Baseline:** `main` at `92108e1c8041f99544c1983ff1d24d6687645a66` / PR #72  
**Active task:** `S1-001 Durable-before-publish core persistence`  
**Active PR:** none

### Scope of S1-001

1. Introduce an explicit durable-write result with typed failure information.
2. Compute a candidate workspace snapshot without publishing it.
3. Serialize and write the candidate through an injectable storage boundary.
4. Verify the stored value by reading it back.
5. Publish state and notify subscribers only after successful verification.
6. Preserve the previous published snapshot after quota, arbitrary storage or read-back failures.
7. Add deterministic regression coverage for state publication, subscriber notification and recovery payloads.

### Explicit exclusions

- no IndexedDB migration;
- no cloud backend, authentication or synchronization;
- no broad UI redesign;
- no new AI/OCR/transcription feature;
- no unrelated refactor of all store consumers.

### Acceptance gate

The task is complete only when the following evidence is green on the same local head:

- the store-safety evaluator is executable in the supported local runtime;
- a failed durable write leaves the published snapshot unchanged;
- subscribers are not notified after a failed durable write;
- successful writes receive read-back verification;
- the UI can receive a typed persistence failure and recovery candidate;
- `npm run verify:store-safety-contract`;
- `npm run eval:store-safety`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`.

## Subsequent Phase 0 slices

These tasks begin only after S1-001 is green:

1. `S2-001` — explicit `WorkspaceRepository` and removal of import-order method mutation.
2. `S3-001` — inventory and shared validation/error contracts for `src/routes/api/ai/*`.
3. `S3-002` — request IDs, payload/time/concurrency/rate/cost limits and idempotency.
4. `S3-003` — real cancellation propagation and late-result rejection.
5. `S4-001` — accessibility baseline and executable one-course pilot harness.

## External validation plan — P1-006 to P1-008

**Status:** externally blocked; deterministic infrastructure exists, live evidence does not.

1. Place four private/licensed images in `private-ocr-assets/`.
2. Run `npm run eval:ocr:live` against a connected Lamdan deployment.
3. Classify and fix live OCR failure categories.
4. Generate one golden quiz from a complete Hebrew source pack and review every question.
5. Promote an approved quiz candidate into permanent fixtures.
6. Run the complete one-course pilot in `PILOT.md`.
7. Fix every critical data-loss, provenance or mobile blocker before declaring M1.

## Verified baseline through PR #72

- long-media intake, reviewed automatic transcription, resumable ranges, local extraction, streaming backup and staged restore — PRs #46, #47, #48, #52, #53 and #54;
- private Hebrew/Russian lecture quality harness — PR #57;
- bounded exam planning — PR #58;
- navigation, focused dashboard, course/material hierarchy and unified study outputs — PRs #61–#64;
- source-reference deletion integrity and multi-page replacement browser proof — PRs #65–#66;
- Study Pack continuation, quiz mistake repair and Exam Engine result/repair flow — PRs #67–#72.

Open historical PRs that predate this baseline are not active implementation sources. Draft PR #73 is also excluded until independently reviewed and merged.
