# Lamdan — Current execution status

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: 92108e1c8041f99544c1983ff1d24d6687645a66
baseline_pr: 72
active_phase: production-phase-0-stabilization
active_task: S1-001
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

Last updated: 2026-07-19

## Current milestone

**Production readiness Phase 0 — stabilization and trustworthy data boundaries**

The verified runtime baseline is `main` through commit `92108e1c8041f99544c1983ff1d24d6687645a66` / PR #72. The previous long-media, Exam Engine and UX delivery passes are merged; no historical PR is the active implementation source. Draft PR #73 is not part of this baseline and is not treated as verified delivery.

**Active task:** `S1-001 Durable-before-publish core persistence`  
**Active PR:** none

The next runtime slice must ensure that a failed durable write cannot publish a candidate workspace state or notify subscribers as though the change were saved. No IndexedDB migration, backend work, broad redesign or new product feature belongs in this task.

## Current product state

Lamdan remains a late MVP / early closed alpha with a substantial local-first, source-grounded learning loop. The following delivery is present in the verified baseline:

- source-linked materials, notes, flashcards, quizzes and Study Packs;
- reviewed OCR and transcription drafts with explicit Apply/Save boundaries;
- multi-page replacement and source-reference integrity browser proof;
- whole-lecture local media, resumable ranges, local extraction, streaming backup and staged restore;
- private Hebrew/Russian lecture-quality harness without a claim of live provider quality;
- frozen Exam Engine, bounded exam planning, result review and mistake-repair flows;
- navigation, dashboard, course/material hierarchy and unified study-flow UX through PRs #61–#72.

## External milestone blockers

The following remain external evidence gates rather than completed product claims:

- `P1-006` live OCR validation on private/licensed Hebrew and mixed-content images;
- `P1-007` reviewed golden quiz from a complete legally usable Hebrew source pack;
- `P1-008` complete one-course pilot after the two live validation gates;
- licensed Hebrew/Russian lecture evaluation with reviewed references, latency and cost evidence.

## Completed task state

- `P0-001` through `P0-023` — complete in the historical product ledger.
- `P1-001` through `P1-005` — implemented; the current production plan reopens persistence honesty as `S1-001` because the core store still publishes state before durable-write confirmation.
- `P1-010A` through `P1-010C4` — merged and verified in PRs #46, #47, #48, #52, #53 and #54.
- Private Hebrew/Russian lecture quality harness — merged in PR #57; live licensed evaluation remains blocked.
- Bounded exam planning — merged in PR #58.
- Workspace navigation, dashboard, course/material hierarchy and unified study outputs — merged in PRs #61–#64.
- Source-reference deletion integrity and multi-page replacement proof — merged in PRs #65–#66.
- Study Pack continuation, quiz repair and Exam Engine result/repair refinements — merged in PRs #67–#72.

## Documentation authority

`TASKS.md` is the canonical executable task ledger, `PLANS.md` describes the active implementation sequence, and this file records evidence and blockers. All three carry the same `LAMDAN_EXECUTION_LEDGER` metadata block, which is checked by `npm run verify:docs`.

## Verified delivery — Whole-lecture intake and reviewed automatic transcription

Delivered in PR #46 and PR #47:

- separate `/app/lecture-media` route and primary navigation item;
- audio/video selection by MIME or common extension;
- explicit 4 GB local per-file boundary;
- sequential 8 MB IndexedDB chunks instead of reading the complete recording into memory;
- browser quota check and best-effort persistent-storage request before upload;
- fresh staging `uploadId` for every new or replacement recording;
- active manifest changes only after every chunk is stored;
- core material is published only after a durable media manifest exists;
- cancellation/error cleanup while an older complete recording remains intact;
- SHA-256 per media chunk and explicit integrity verification;
- local audio/video player reconstructed only after an explicit user action;
- SRT, WebVTT and plain-text transcript import;
- editable transcript blocks with timecodes, speaker labels and explicit approval states;
- only approved non-empty segments become normal Lamdan source chunks;
- optional server-side OpenAI Audio Transcriptions provider with credentials kept server-side;
- exact provider, model, file and size disclosure before upload;
- explicit consent, upload progress, cancellation, retry and persisted attempt count;
- bounded 24 MB provider-ready request and separate compressed provider-copy option;
- separate local candidate store with timestamps, language, speakers, uncertainty and visible uncovered intervals;
- stale result rejection through `sourceUploadId`;
- candidate loads into the editor only with `status: "draft"`;
- zero source-chunk changes until manual review and Apply;
- real Chromium proofs for 18 MB local storage/apply/reload and cancellation → retry → candidate → draft → reload.

## Verified historical delivery — P1-010C1 through P1-010C4

The long-media sequence is complete in the verified baseline:

- C1 resumable provider-range queues — PR #48;
- C2 automatic local range extraction/transcoding — PR #52;
- C3 streaming lecture backup — PR #53;
- C4 staged streaming lecture restore — PR #54.

The original C1 manual-clip boundary is retained as fallback behavior, not as the active product limitation. Local extraction, streaming backup and staged restore superseded the earlier statements that Lamdan could not generate clips or preserve long-media companion data outside Workspace ZIP v2.

Dedicated contracts, deterministic evaluations and Chromium proofs were part of those merged delivery slices. The remaining unresolved question is live licensed provider quality, latency and cost, which cannot be inferred from deterministic mocks.

## Existing validation blockers

### P1-006

Live OCR quality cannot be measured without four private/licensed photos and a reachable deployment with the AI provider configured.

### P1-007

Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.

### P1-008

The one-course closed pilot depends on P1-006 and P1-007. M1 remains unachieved until the complete script passes.

### P1-010 live provider quality

The deterministic/provider-mock pipeline can verify consent, persistence, cancellation, partial recovery and source integrity. Real transcription quality, latency, cost and provider error handling still require a deployment with provider credentials and licensed representative Hebrew/Russian lecture audio.

## Next execution targets

**Active task:** `S1-001 Durable-before-publish core persistence`

1. Prove that failed durable writes cannot publish candidate state or notify subscribers.
2. Introduce the explicit repository/source-integrity boundary only after S1-001 is green.
3. Harden AI API validation, resource controls and cancellation in separate bounded slices.
4. Run `P1-006`, `P1-007` and `P1-008` when licensed inputs and a connected deployment are available.
