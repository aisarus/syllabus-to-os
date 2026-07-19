# Lamdan — P0 Implementation Tasks and Production Readiness Ledger

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 716f8ba4c7430f30635fe2b6934b562ae2ec6abf
baseline_pr: 76
active_phase: production-phase-0-stabilization
active_task: S3-001
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

- **Status:** [x]
- **Merged:** PR #75
- **Evidence:** quota, unavailable-storage, serialization and read-back failures preserve the published snapshot; ordinary subscribers are not notified; recovery retry/export remains available.

## S2-001 — Explicit WorkspaceRepository and import-order independence

- **Status:** [x]
- **Merged:** PR #76
- **Evidence:** base mutators use `WorkspaceRepository`; source deletion/replacement is implemented as pure transforms; shared store method identity survives compatibility imports; flashcard evidence subscribes explicitly after successful persistence.

## S3-001 — AI API inventory and shared validation/error contracts

- **Status:** [ ]
- **Priority:** active P0 production blocker
- **Size:** M
- **Depends on:** S1-001 and S2-001
- **Active task:** `S3-001`
- **Current PR:** none

### Problem

AI server routes have grown independently. Their actual request schemas, maximum inputs and error responses are not yet represented by one runtime contract, so malformed input and provider failures can behave inconsistently.

### Scope

- inventory every `src/routes/api/ai/*` endpoint and its current input/output/provider boundary;
- introduce shared Zod parsing helpers for JSON and form-data metadata where applicable;
- introduce one redacted JSON error envelope with stable error codes and HTTP status mapping;
- preserve draft-only AI/OCR/transcription behavior and existing successful response shapes;
- add deterministic contract tests for malformed JSON, missing fields, wrong field types, oversized declared values and redacted internal failures;
- migrate routes in bounded groups without changing product behavior.

### Acceptance criteria

- the endpoint inventory is generated or verified from the actual route tree;
- every migrated endpoint validates input before provider invocation;
- malformed input receives a deterministic 4xx JSON response;
- provider/internal errors do not expose secrets, stack traces or raw source content;
- successful response contracts remain compatible;
- relevant endpoint contracts/evals, `npm run typecheck`, `npm run lint` and `npm run build` pass on the same local head.

### Explicit exclusions

- request IDs and distributed tracing;
- rate, concurrency, timeout and cost limits;
- idempotency keys;
- AbortSignal propagation;
- authentication/backend redesign;
- new AI product features.

## Queued stabilization tasks

1. `S3-002` — request IDs, payload/time/concurrency/rate/cost limits and idempotency.
2. `S3-003` — real AbortSignal propagation and late-result rejection.
3. `S4-001` — accessibility baseline and executable one-course pilot harness.
4. `D1-001` — versioned schemas and IndexedDB planning only after stabilization is green.

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

# Verified baseline through PR #76

The following capabilities are present in the baseline and are not active implementation tasks:

- core material intake, review, chunks, source-linked notes/cards/quizzes and backup;
- reviewed OCR, multipage image handling and source-integrity repair;
- Study Command Center, Study Pack and concept/evidence flows;
- long-media local intake, reviewed transcription, resumable ranges, local extraction, streaming backup and staged restore — PRs #46, #47, #48, #52, #53 and #54;
- private Hebrew/Russian lecture-quality harness — PR #57, while live licensed evaluation remains blocked;
- bounded exam planning — PR #58;
- navigation, focused dashboard, course/material hierarchy and unified study flow — PRs #61–#64;
- source-reference deletion integrity and multipage replacement browser proof — PRs #65–#66;
- Study Pack continuation, quiz repair and Exam Engine result/repair refinements — PRs #67–#72;
- durable-before-publish persistence and explicit repository/import-order boundaries — PRs #75–#76.

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

**Active task:** `S3-001 AI API inventory and shared validation/error contracts`
**Active PR:** none

1. Complete `S3-001` inventory, runtime validation and stable error-envelope contracts.
2. Complete `S3-002` request/resource/cost/idempotency controls.
3. Complete `S3-003` cancellation propagation and late-result rejection.
4. Complete `S4-001` accessibility baseline and executable pilot harness.
5. Begin versioned schemas and IndexedDB only after stabilization is green.
6. Run `P1-006`, `P1-007` and `P1-008` when licensed inputs and a connected deployment are available.
