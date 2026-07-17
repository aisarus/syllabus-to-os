# Lamdan — Current execution status

Last updated: 2026-07-17

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output loop is implemented. M1 is still blocked on private live OCR and quiz validation. Concept evidence, reviewed extraction, open-answer repair, collision hardening, Exam Engine v1, durable whole-lecture media intake, reviewed automatic transcription v1 and resumable provider-range queues are implemented and verified. P1-010C2 local range extraction/transcoding is the active delivery pass.

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
- `P1-010C2 Local range extraction/transcoding` — [~] implementation complete locally; deterministic checks pass and the dedicated Chromium workflow is pending remote confirmation.
- `P1-011 Study Command Center v1` — complete and verified; PR #36.
- `P1-012 Lecture-to-Study-Pack` — complete and verified; PR #37.
- `P1-013 Concept graph and evidence model v1` — complete and verified; PR #38.
- `P1-013A per-question quiz evidence` — complete and verified; PR #39.
- `P1-013B Workspace backup v2` — complete and verified; PR #41.
- `P1-013C Reviewed concept extraction` — complete and verified; PR #42.
- `P1-013D Open-answer evidence and mistake repair` — complete and verified; PR #43.
- `P1-013E Edited-batch concept collision guard` — complete and verified; PR #44.
- `P1-014A Frozen source-grounded Exam Engine v1` — complete and verified; PR #45.

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

## Verified delivery — P1-010C1 resumable provider-range queues

Delivered on `agent/resumable-long-transcription` / PR #48:

- exact 15-minute range planning with a two-second overlap;
- one persisted status machine per range: `needs_file`, `ready`, `uploading`, `processing`, `review_ready`, `cancelled` or `failed`;
- separate provider-ready clip selection per displayed lecture range;
- explicit consent naming provider, model and selected file count;
- sequential uploads so one failure cannot destroy another completed range;
- independent retry/cancellation and persisted attempt/request history;
- clip-relative timestamps offset into the complete lecture timeline;
- exact overlap duplicates merged without filling uncovered speech from model memory;
- failed, cancelled and unselected ranges remain visible as gaps;
- completed results persist in a separate IndexedDB queue;
- interrupted/selected files return to `needs_file` after reload because browser `File` objects are intentionally not persisted;
- stale queue rejection after the recording is replaced;
- merged results load only as an unapproved transcript draft;
- ordinary manual review and Apply remain the only route to source chunks;
- guarded orphan cleanup and Data-page deletion for range queues;
- deterministic evaluation coverage for range planning, overlap merge, partial failure, stale upload and interrupted-tab recovery;
- Chromium proof: two range files → first success → isolated second failure → retry → overlap merge → three draft segments → reload, with zero source chunks throughout.

Current boundary before P1-010C2:

- Lamdan does not yet extract or transcode provider-ready clips automatically from the local multi-gigabyte original;
- the student selects a clip matching each exact displayed range;
- a browser reload cannot recreate selected `File` objects, so unfinished clips must be selected again;
- provider output remains untrusted until review and approval;
- raw media, editable transcript drafts, single-request candidates and resumable queues are not yet in Workspace ZIP v2;
- live quality, latency and cost remain unverified without a configured provider and licensed representative lecture audio.

## Active delivery — P1-010C2 local range extraction

Implemented in the current branch, pending dedicated Chromium CI:

- explicit browser capability detection for media-element capture, `MediaRecorder` and audio/WebM;
- conservative provider-size, temporary-storage and normal-speed wall-time estimates before extraction;
- 1× local audio capture with staged IndexedDB chunk persistence, cancellation cleanup and no complete-source `arrayBuffer()` read;
- exact material/upload/range identity, seek, duration, MIME and provider-size validation before a clip may enter the C1 queue;
- a persisted local clip restores after reload, while a manual C1 replacement clears its extraction provenance;
- lifecycle and Data-page deletion cover staged/local clips as well as original media and C1 queues;
- deterministic capability/estimate/promotion/recovery evaluations, contract and a real two-second WAV Chromium scenario wired into a dedicated workflow.

The current environment has no usable local Chromium proof. Do not mark this task verified until the new GitHub Actions browser workflow is green.

## Verification state

PR #48 passed its final common head and was merged into `main` as `199ce45`. Verification included:

- permanent resumable-transcription contract;
- deterministic range/merge/recovery evaluations;
- TypeScript, ESLint and formatting;
- production build;
- Chromium partial-failure/retry/draft/reload proof;
- zero automatic source chunks.

The final matrix included complete repository CI, existing automatic-transcription, long-media and Exam Engine regression workflows, plus the critical browser end-to-end gate.

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

1. Run the `P1-010C2` Chromium workflow and fix any real browser-capability regression before marking the local range path verified.
2. Integrate raw media, editable drafts, provider candidates, extracted clips and range queues into a streaming backup format.
3. Extend Exam Engine with exam profiles, topic weights and bounded daily planning.
4. Run `P1-006`, `P1-007` and the one-course pilot when private inputs are supplied.
