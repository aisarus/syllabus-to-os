# Lamdan — P0 Implementation Tasks and Production Readiness Ledger

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: ed11ca59c0c9a0ab8029822e5d283656536e4442
baseline_pr: 85
active_phase: production-phase-0-stabilization
active_task: S4-001
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

## S3-003 — Real cancellation propagation and late-result rejection

- **Status:** [x]
- **Merged:** PRs #83 and #85
- **Evidence:** client cancellation and operation timeout abort the execution signal; Lovable/Gemini and OpenAI transcription fetch paths consume the composed signal; aborted work is not retried or cached; late completion cannot become a successful replay.

## S4-001 — Accessibility baseline and executable one-course pilot harness

- **Status:** [ ]
- **Priority:** active P0 production blocker
- **Depends on:** S1-001 through S3-003
- **Active task:** `S4-001`
- **Current PR:** none

### Problem

The core study capabilities exist, but production readiness also requires keyboard-operable navigation, predictable focus, mixed RTL/LTR support and a pilot procedure that can produce repeatable evidence. The current checklist must not be treated as a completed pilot.

### Scope

- audit keyboard reachability and visible focus across the core shell and student study loop;
- verify dialog focus trap, restoration and Escape behavior;
- correct mixed Hebrew/Russian/English directionality with explicit `dir` behavior where needed;
- remove critical contrast and undersized metadata blockers in core paths;
- add deterministic accessibility contracts and targeted browser checks where the local environment supports them;
- convert `PILOT.md` into a reproducible harness with setup, fixtures, expected results, evidence paths and explicit external blockers.

### Acceptance criteria

- every primary shell action and core study-flow control is reachable and usable without a pointer;
- focus is visible and returns to the invoking control after modal/dialog close;
- Escape closes dismissible overlays without discarding approved data;
- mixed RTL/LTR content remains readable and correctly aligned;
- critical automated accessibility violations are absent from the tested shell surfaces;
- the pilot can be followed from an empty workspace with exact expected results and evidence locations;
- P1-006/P1-007/provider-dependent steps remain marked blocked until real licensed inputs exist.

### Explicit exclusions

- broad visual redesign;
- new student-facing AI features;
- declaring P1-008 complete without live evidence;
- IndexedDB migration or cloud backend work.

## Queued data task

1. `D1-001` — versioned local schemas and IndexedDB migration after stabilization is green.

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

**Active task:** `S4-001 accessibility baseline and executable one-course pilot harness`  
**Active PR:** none

1. Complete S4-001.
2. Begin versioned schemas and IndexedDB only after stabilization is green.
3. Run P1-006, P1-007 and P1-008 when licensed inputs and a connected deployment are available.
