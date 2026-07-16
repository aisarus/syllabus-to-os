# Lamdan — Current execution status

Last updated: 2026-07-16

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live OCR and quiz validation. Concept evidence, reviewed extraction, open-answer repair, collision hardening, Exam Engine v1, durable whole-lecture media intake, reviewed automatic transcription, resumable range queues and local exact-range extraction are implemented and verified.

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
- `P1-010A Durable whole-lecture audio/video intake` — complete and verified; PR #46.
- `P1-010B Reviewed automatic transcription v1` — complete and verified; PR #47.
- `P1-010C1 Resumable provider-range queues` — complete and verified; PR #48.
- `P1-010C2 Local exact-range extraction` — complete and verified on PR #49; final documentation head under revalidation.
- `P1-011 Study Command Center v1` — complete and verified; PR #36.
- `P1-012 Lecture-to-Study-Pack` — complete and verified; PR #37.
- `P1-013 Concept graph and evidence model v1` — complete and verified; PR #38.
- `P1-013A per-question quiz evidence` — complete and verified; PR #39.
- `P1-013B Workspace backup v2` — complete and verified; PR #41.
- `P1-013C Reviewed concept extraction` — complete and verified; PR #42.
- `P1-013D Open-answer evidence and mistake repair` — complete and verified; PR #43.
- `P1-013E Edited-batch concept collision guard` — complete and verified; PR #44.
- `P1-014A Frozen source-grounded Exam Engine v1` — complete and verified; PR #45.

## Verified delivery — Whole-lecture processing stack

Delivered in PR #46 through PR #49:

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
- exact 15-minute resumable range queues with two-second overlap;
- independent range failure, cancellation and retry without erasing completed ranges;
- exact overlap merge without inventing uncovered speech;
- local exact-range clips persisted in a separate IndexedDB store;
- PCM WAV fast path that reads only the required frame-aligned bytes from existing 8 MB chunks;
- bounded real-time MediaRecorder fallback for supported compressed audio and video;
- explicit local-extraction consent and provider consent as separate actions;
- generated clips attached to the existing revision-safe range queue;
- local clips included in guarded orphan cleanup and Data-page deletion;
- provider output remains an unapproved merged draft after reload;
- raw media, editable drafts, provider candidates, range queues and extracted clips remain outside Workspace ZIP v2.

## P1-010C2 verification state

PR #49 passed on the same final product head:

- permanent local-range extraction contract;
- deterministic HTTP Range, invalid-range and extraction-estimate evaluations;
- TypeScript, ESLint, formatting and production build;
- complete repository CI and all existing critical browser end-to-end gates;
- Automatic Transcription regression;
- Resumable Transcription regression;
- Long Lecture Media regression;
- Exam Engine regression;
- real Chromium WAV fixture stored in IndexedDB;
- exact PCM frame extraction into a new valid local WAV clip;
- separate Service Worker `206` Range verification;
- persisted clip and reload-safe local queue attachment;
- provider mock upload after explicit local-panel consent;
- merged provider result loaded only as an unapproved draft;
- zero automatic source chunks before manual review and Apply.

The final documentation-only commit must repeat the matrix before merge.

## Current boundaries

- PCM RIFF/WAVE has a fast exact-byte extraction path.
- Compressed audio and video use a bounded real-time fallback and depend on browser codec support.
- Local clips and raw recordings are not yet included in Workspace ZIP v2.
- No original recording or generated clip is uploaded without explicit consent.
- Provider output remains untrusted until ordinary transcript review and Apply.
- Live quality, latency and cost remain unverified without a configured provider and licensed representative Hebrew/Russian lecture audio.

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

1. Merge PR #49 after the final documentation head repeats all six workflows.
2. Add streaming backup/export for raw media, editable drafts, provider candidates, range queues and extracted clips.
3. Validate real Hebrew/Russian lecture transcription quality on licensed audio and record latency/cost.
4. Extend Exam Engine with exam profiles, topic weights and bounded daily planning.
5. Run `P1-006`, `P1-007` and the one-course pilot when private inputs are supplied.
