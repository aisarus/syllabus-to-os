# Lamdan — P0 Implementation Tasks and Production Readiness Ledger

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 92108e1c8041f99544c1983ff1d24d6687645a66
baseline_pr: 72
active_phase: production-phase-0-stabilization
active_task: S1-001
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

This is the canonical executable task ledger for Lamdan. Product intent lives in `ROADMAP.md`; the current delivery sequence lives in `PLANS.md`; evidence and blockers live in `STATUS.md`. Detailed historical acceptance notes remain available in Git history and merged pull requests.

## Status legend

- `[ ]` not started
- `[~]` in progress or implemented but not fully verified
- `[x]` complete and verified
- `[!]` blocked by external input or environment

## Global definition of done

A task is complete only when its applicable contracts/evals pass on the same head, approved data survives reload, source relationships remain valid, generated content stays draft until explicit Apply/Save, and skipped environment-dependent checks are recorded as blockers rather than successes.

---

# Production readiness execution

## S1-001 — Durable-before-publish core persistence

- **Status:** [ ]
- **Priority:** active P0 production blocker
- **Size:** M
- **Depends on:** verified `main` through PR #72 and synchronized execution docs
- **Active task:** `S1-001`
- **Current PR:** none

### Problem

The core workspace store assigns candidate state before attempting `localStorage.setItem`, suppresses write failures and still notifies subscribers. A quota or storage failure can therefore appear saved until reload.

### Scope

- compute a candidate snapshot without publishing it;
- write through an injectable durable-storage boundary;
- verify the stored value by reading it back;
- publish state and notify listeners only after verification;
- expose typed failure information and an exportable recovery candidate;
- add deterministic success, quota, arbitrary-error, read-back-mismatch and subscriber regressions.

### Acceptance criteria

- failed writes leave the published snapshot unchanged;
- failed writes do not notify subscribers;
- successful writes receive read-back verification;
- callers can distinguish quota, unavailable-storage, serialization and verification failures;
- the recovery candidate is exportable without becoming current state;
- `npm run verify:store-safety-contract`, `npm run eval:store-safety`, `npm run typecheck`, `npm run lint` and `npm run build` pass on the same local head.

### Explicit exclusions

- IndexedDB migration;
- backend, authentication or sync;
- broad redesign;
- new product or AI features;
- unrelated conversion of every store consumer.

## Queued stabilization tasks

1. `S2-001` — explicit `WorkspaceRepository` and removal of import-order method mutation.
2. `S3-001` — inventory all AI API endpoints and introduce shared Zod/error contracts.
3. `S3-002` — request IDs, time/payload/concurrency/rate/cost limits and idempotency.
4. `S3-003` — real AbortSignal propagation and late-result rejection.
5. `S4-001` — accessibility baseline and executable one-course pilot harness.
6. `D1-001` — versioned schemas and IndexedDB planning only after stabilization is green.

---

# External evidence gates

## P1-006 — Live OCR validation

- **Status:** [!]
- **Depends on:** P1-005 and the reviewed OCR pipeline
- **Blocked by:** private/licensed Hebrew and mixed-content images plus a connected provider-enabled deployment

### Acceptance

- every fixture receives an external candidate;
- CER/WER, critical-token, math-expression and line-order thresholds pass;
- handwriting requests review;
- unreadable input abstains;
- no private asset is committed.

## P1-007 — Golden Hebrew quiz validation

- **Status:** [!]
- **Depends on:** deterministic quiz evaluation and source-integrity contracts
- **Blocked by:** one complete legally usable Hebrew source pack and human review

### Acceptance

- every question is source-grounded and reviewable;
- unsupported or ambiguous questions are rejected;
- an approved candidate becomes a permanent fixture only after review.

## P1-008 — One-course closed pilot

- **Status:** [!]
- **Depends on:** P1-006 and P1-007
- **Blocked by:** completion of both live evidence gates

### Acceptance

Run the full `PILOT.md` flow from empty workspace through syllabus, sources, Study Pack, practice, exam repair, backup, clear and restore. Fix every critical data-loss, provenance or mobile blocker before declaring the milestone.

---

# Verified baseline through PR #72

The following capabilities are present in the baseline and are not active implementation tasks:

- core material intake, review, chunks, source-linked notes/cards/quizzes and backup;
- reviewed OCR, multipage image handling and source-integrity repair;
- Study Command Center, Study Pack and concept/evidence flows;
- long-media local intake, reviewed transcription, resumable ranges, local extraction, streaming backup and staged restore — PRs #46, #47, #48, #52, #53 and #54;
- private Hebrew/Russian lecture-quality harness — PR #57, while live licensed evaluation remains blocked;
- bounded exam planning — PR #58;
- navigation, focused dashboard, course/material hierarchy and unified study flow — PRs #61–#64;
- source-reference deletion integrity and multipage replacement browser proof — PRs #65–#66;
- Study Pack continuation, quiz repair and Exam Engine result/repair refinements — PRs #67–#72.

Historical open PRs that predate this baseline are not active sources of truth. Draft PR #73 is excluded until independently reviewed and merged.

---

# Deferred product backlog

These tasks remain outside the active stabilization scope:

- `P1-015` Assignment Copilot;
- `P1-016` Lecture Mode;
- `P1-017` Ask My Course;
- `P1-018` workload forecasting and calendar integration;
- `P1-019` personal explanation/accessibility preferences.

They must not begin before data-loss, persistence, API-abuse, cancellation and release blockers are closed.

# Current execution order

**Active task:** `S1-001 Durable-before-publish core persistence`  
**Active PR:** none

1. Complete `S1-001` and prove failed writes cannot publish or notify.
2. Complete `S2-001` explicit repository/source-integrity boundary.
3. Complete `S3-001` through `S3-003` API validation, resource controls and cancellation.
4. Complete `S4-001` accessibility baseline and executable pilot harness.
5. Begin versioned schemas and IndexedDB only after stabilization is green.
6. Run `P1-006`, `P1-007` and `P1-008` when licensed inputs and a connected deployment are available.
