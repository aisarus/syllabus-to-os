# Lamdan — Current execution status

Last updated: 2026-07-16

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live OCR and quiz validation. Concept evidence, reviewed extraction, open-answer repair, collision hardening, Exam Engine v1 and durable whole-lecture media intake are implemented and verified. Reviewed automatic transcription v1 is the active delivery pass.

## Completed task state

- `P0-001` through `P0-020` — complete and verified.
- `P0-021 Durable image intake and OCR review` — complete and verified.
- `P0-022A Image Preprocessing Workspace` — complete and verified; PR #28.
- `P0-022B OCR Region Overlay and Sync` — complete and verified; PR #29.
- `P0-022C Full Visual Backup and Restore` — complete and verified; PR #30.
- `P0-023 Quizlet-style cards and golden generated quizzes` — complete and verified.
- `P1-001 Multi-page image materials` — complete and verified; PR #31.
- `P1-002 Golden quiz quality evaluation` — complete and verified; PR #32.
- `P1-003 Critical browser end-to-end coverage` — complete and verified; PR #33.
- `P1-004 Add local-first global search v2` — complete and verified; PR #34.
- `P1-005 Store persistence and source-integrity hardening` — complete and verified; PR #35.
- `P1-010A Durable whole-lecture audio/video intake` — complete and verified; PR #46 merged.
- `P1-010B Reviewed automatic transcription v1` — [~] implemented on PR #47; verification active.
- `P1-011 Study Command Center v1` — complete and verified; PR #36.
- `P1-012 Lecture-to-Study-Pack` — complete and verified; PR #37.
- `P1-013 Concept graph and evidence model v1` — complete and verified; PR #38.
- `P1-013A per-question quiz evidence` — complete and verified; PR #39.
- `P1-013B Workspace backup v2` — complete and verified; PR #41.
- `P1-013C Reviewed concept extraction` — complete and verified; PR #42.
- `P1-013D Open-answer evidence and mistake repair` — complete and verified; PR #43.
- `P1-013E Edited-batch concept collision guard` — complete and verified; PR #44.
- `P1-014A Frozen source-grounded Exam Engine v1` — complete and verified; PR #45.

## Verified delivery — Durable whole-lecture audio/video intake

Delivered:

- separate `/app/lecture-media` route and primary navigation item;
- audio/video selection by MIME or common extension;
- explicit 4 GB local per-file boundary;
- sequential 8 MB IndexedDB chunks instead of reading the complete recording into memory;
- browser quota check and best-effort persistent-storage request before upload;
- fresh staging `uploadId` for every new or replacement recording;
- active manifest changes only after every chunk is stored;
- core material is published only after a durable media manifest exists;
- cancellation/error cleanup while an older complete recording remains intact;
- post-commit cleanup, optional metadata and navigation failures cannot delete a completed recording;
- automatic orphan cleanup requires the same missing material to remain absent from fresh core snapshots for at least 15 seconds before deletion;
- SHA-256 per media chunk and explicit integrity verification;
- local audio/video player reconstructed only after an explicit user action;
- SRT, WebVTT and plain-text transcript import;
- editable ten-minute transcript blocks with timecodes and optional speaker labels;
- `empty`, `draft` and `approved` transcript states;
- only approved non-empty segments become normal Lamdan source chunks;
- source-integrity-aware transcript apply and normal Study Pack compatibility;
- orphan cleanup, local storage statistics and local-media delete control;
- real Chromium proof: 18 MB → three IndexedDB chunks → SHA verification → SRT → two approved source chunks → reload.

## Active implementation pass — Reviewed automatic transcription

Delivered on `agent/automatic-long-media-transcription` / PR #47:

- optional server-side OpenAI Audio Transcriptions provider;
- server credentials only through `OPENAI_API_KEY`;
- exact provider, model, file and size disclosure before upload;
- upload disabled until explicit consent;
- no hidden upload during navigation, local storage, playback, SHA verification or manual transcript work;
- bounded 24 MB provider-ready request and explicit supported-format validation;
- separate compressed provider-copy selection when the local original is too large or unsupported;
- upload progress, cancellation, retry and persisted attempt count;
- separate local IndexedDB candidate store with no secrets or request body;
- stale result rejection after lecture replacement through `sourceUploadId`;
- timestamp, language, speaker, uncertainty and uncovered-interval display;
- candidate remains separate until an explicit “load into editor as draft” action;
- every loaded provider segment starts as `draft`, never `approved`;
- cancellation, failure, retry and draft loading do not alter existing applied source chunks;
- Data-page cleanup and guarded orphan pruning for provider candidates;
- deterministic contract/evaluation suite and a Chromium cancellation → retry → candidate → draft → reload proof are being wired.

Current boundaries:

- this is a bounded provider-upload v1, not automatic transcoding of an arbitrary 4 GB original;
- one provider request is capped at 24 MB;
- larger originals require a user-supplied compressed complete-lecture copy;
- resumable multi-part provider jobs remain a later slice;
- provider output is untrusted until manually reviewed and approved;
- missing or unintelligible intervals remain visible instead of being filled from model memory;
- Workspace ZIP v2 does not yet contain raw media, editable transcript drafts or provider candidates;
- live provider quality remains unverified without a configured deployment and licensed real lecture audio.

## Verification state

PR #47 must pass on one final head:

- automatic-transcription contract and deterministic evaluations;
- TypeScript, ESLint and formatting;
- production build and committed TanStack route tree;
- browser proof for explicit consent, cancellation, retry, two timestamped provider segments, visible gap/uncertainty, draft-only loading and reload;
- zero source chunks before manual approval/apply;
- complete repository CI;
- dedicated Exam Engine and long-media regressions.

## Existing validation blockers

### P1-006

Live OCR quality cannot be measured without four private/licensed photos and a reachable deployment with the AI provider configured.

### P1-007

Live golden quiz quality cannot be approved without a complete legally usable Hebrew source pack.

### P1-008

The one-course closed pilot depends on P1-006 and P1-007. M1 remains unachieved until the complete script passes.

### P1-010B live provider quality

The deterministic/provider-mock pipeline can verify consent, persistence, cancellation and source integrity. Real transcription quality, latency and provider error handling still require a deployment with `OPENAI_API_KEY` and licensed representative lecture audio.

## Next execution targets

1. Verify and merge reviewed automatic transcription v1 in PR #47.
2. Add automatic local transcoding or resumable multi-part jobs for originals above the one-request provider limit.
3. Integrate long-media drafts/candidates into a streaming backup format.
4. Extend Exam Engine with exam profiles, topic weights and bounded study planning.
5. Run `P1-006`, `P1-007` and the one-course pilot when private inputs are supplied.
