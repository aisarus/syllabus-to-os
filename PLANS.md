# Lamdan implementation plans

This file records the active implementation plan. Product intent remains in `ROADMAP.md`; canonical task status and acceptance criteria live in `TASKS.md`; evidence and blockers live in `STATUS.md`.

## M1 validation plan — P1-006 to P1-008

**Status:** externally blocked, infrastructure ready.

1. Place four private/licensed images in `private-ocr-assets/`.
2. Run `npm run eval:ocr:live` against a connected Lamdan preview.
3. Classify and fix live OCR failure categories.
4. Generate one golden quiz from a complete Hebrew source pack and review every question.
5. Promote an approved quiz candidate into permanent fixtures.
6. Run the complete one-course pilot in `PILOT.md`.
7. Fix every critical data-loss, provenance or mobile blocker before declaring M1.

## Completed Academic Autopilot slices

- `P1-010A Durable whole-lecture audio/video intake` — merged and verified in PR #46.
- `P1-010B Reviewed automatic transcription v1` — merged and verified in PR #47.
- `P1-011 Study Command Center v1` — merged in PR #36.
- `P1-012 Lecture-to-Study-Pack` — merged in PR #37.
- `P1-013 Concept graph and evidence model v1` — merged in PR #38.
- `P1-013A Per-question quiz evidence` — merged in PR #39.
- `P1-013B Workspace backup v2` — merged in PR #41.
- `P1-013C Reviewed concept extraction` — merged in PR #42.
- `P1-013D Open-answer evidence and mistake repair` — merged in PR #43.
- `P1-013E Edited-batch concept collision guard` — merged in PR #44.
- `P1-014A Frozen source-grounded Exam Engine v1` — merged in PR #45.

## Verified delivery — P1-010A Whole-lecture media

### Product outcome

A user can upload one complete audio or video lecture, keep it locally across reloads, play it, import or edit a timestamped transcript, and explicitly approve transcript segments before they become source chunks.

### Delivered sequence

1. Separate the media path from ordinary document extraction. ✓
2. Validate common audio/video MIME types and extensions. ✓
3. Enforce an explicit 4 GB local per-file boundary. ✓
4. Write the browser `File` sequentially in 8 MB IndexedDB chunks. ✓
5. Check available browser quota and request persistent storage before the write. ✓
6. Keep replacement uploads under a staging `uploadId` until every chunk succeeds. ✓
7. Publish the core material only after a durable manifest exists. ✓
8. Preserve the previous complete file after cancellation, write failure or post-commit cleanup failure. ✓
9. Record and verify SHA-256 for every stored chunk. ✓
10. Reconstruct a local audio/video player only after explicit user action. ✓
11. Import SRT, WebVTT or plain-text transcript drafts. ✓
12. Create editable timestamp blocks when no transcript is available. ✓
13. Require explicit approval for each source segment. ✓
14. Convert only approved non-empty segments into source-integrity-aware `MaterialChunk` records. ✓
15. Add navigation, material-detail integration, guarded orphan cleanup and Data-page storage boundary. ✓
16. Add deterministic file/segment/import/apply evaluations. ✓
17. Repair the production preview path and async IndexedDB browser predicate. ✓
18. Pass a Chromium proof using an 18 MB file written as three IndexedDB chunks, SHA-checked, transcribed from SRT, applied as two source chunks and reloaded. ✓
19. Pass complete repository CI and dedicated regressions on the same final head. ✓
20. Merge PR #46. ✓

## Verified delivery — P1-010B Reviewed automatic transcription v1

### Product outcome

A user explicitly chooses to send one provider-ready recording copy for transcription, sees which provider/model/file receives it, can cancel and retry, inspects timestamp gaps and uncertain speaker-labelled segments, and loads the result only as an unapproved editable draft.

### Delivered sequence

1. Keep the built-in local/manual workflow fully usable without an external provider. ✓
2. Add an optional OpenAI Audio Transcriptions server adapter with server-only credentials. ✓
3. Cap one provider request at 24 MB and validate supported formats before upload. ✓
4. Allow a separately selected compressed provider copy while keeping the large local original private. ✓
5. Add an explicit consent surface naming provider, model, exact file and size. ✓
6. Guarantee that navigation, playback, SHA checking and manual transcript work trigger no upload. ✓
7. Persist local job status, attempt count, provider request id and returned candidate without secrets. ✓
8. Support cancellation, retry and interrupted-tab recovery. ✓
9. Reject a result tied to an older lecture `sourceUploadId`. ✓
10. Preserve timestamps, language, speaker labels and provider uncertainty warnings. ✓
11. Surface uncovered ranges instead of filling missing speech from model memory. ✓
12. Keep provider output outside the current transcript until a separate user action. ✓
13. Load every provider segment with `status: "draft"`. ✓
14. Keep applied source chunks unchanged after failure, cancellation, retry or draft loading. ✓
15. Include provider candidates in local data controls and guarded orphan cleanup. ✓
16. Add deterministic job-state, stale-upload, gap and source-integrity evaluations. ✓
17. Pass browser proof for consent → cancel → retry → candidate → draft-only load → reload. ✓
18. Pass complete CI and existing regressions on one final head. ✓
19. Merge PR #47. ✓

### Non-negotiable boundaries

- No hidden upload during local storage, playback, integrity checking or ordinary navigation.
- The exact external provider, model, file and size are shown before upload.
- Cancelled or failed work cannot replace the current transcript or source chunks.
- Provider text remains untrusted until explicitly loaded into the editor.
- Loaded provider blocks remain `draft` until individually reviewed and approved.
- Missing intervals remain visible instead of being filled from model memory.
- Secrets and provider credentials remain server-side.
- A stale candidate from a replaced recording cannot be applied.
- Workspace ZIP v2 does not claim to contain provider candidates.

## Verified delivery — P1-010C1 Resumable provider-range queues

### Product outcome

A student can divide a long lecture into exact overlapping ranges, upload provider-ready clips sequentially, preserve completed ranges when another range fails, retry only the failed range, and merge successful timestamped results into one unapproved draft.

### Implemented sequence on PR #48

1. Plan exact 15-minute ranges with a two-second overlap. ✓
2. Persist one independent range state machine and attempt history in IndexedDB. ✓
3. Require a separately selected provider-ready clip for every range sent in C1. ✓
4. Display provider, model, selected file count and exact range boundaries before consent. ✓
5. Upload selected ranges sequentially rather than as one all-or-nothing request. ✓
6. Preserve successful range results when another range fails or is cancelled. ✓
7. Support independent retry and current-range cancellation. ✓
8. Offset provider timestamps from clip time into complete-lecture time. ✓
9. Merge exact overlap duplicates without inventing uncovered speech. ✓
10. Keep failed, cancelled and unselected ranges visible as gaps. ✓
11. Reject queues tied to a replaced `sourceUploadId`. ✓
12. Recover interrupted tabs while preserving completed results and requiring `File` reselection. ✓
13. Load merged segments only as `draft`; create no source chunks automatically. ✓
14. Include range queues in guarded orphan cleanup and Data-page deletion. ✓
15. Add deterministic planning, overlap, failure, recovery and source-integrity evaluations. ✓
16. Add Chromium proof for two clips → isolated failure → retry → overlap merge → draft → reload. ✓
17. Pass the dedicated contract, eval, TypeScript, lint, build and browser workflow. ✓
18. Pass complete repository CI and existing automatic-transcription, long-media and Exam Engine regressions. ✓
19. Merge PR #48. ✓

### C1 boundary

C1 deliberately does not claim automatic extraction from the local multi-gigabyte original. The user selects provider-ready clips matching the exact displayed ranges. Browser `File` objects are not persisted; unfinished clips must be selected again after reload.

### Non-negotiable boundaries

- No original or range clip uploads without explicit consent.
- A completed range cannot be erased by an unrelated failed range.
- Provider timestamps must remain inside the displayed range and lecture duration.
- Missing ranges remain visible.
- Merged output remains an editable draft.
- No provider range result becomes a source chunk automatically.

## Verified delivery — P1-010C2 Automatic local range extraction/transcoding

### Bounded local strategy

1. Detect the local browser capabilities needed for media-element capture and recording. Keep the already verified manual C1 range-file path as the explicit fallback when they are unavailable.
2. Reconstruct a local playback source without reading the complete recording through `arrayBuffer()`, seek to the persisted range boundary and capture only its audio track at normal playback speed.
3. Persist recorder output incrementally under a staging identifier; report CPU, elapsed wall time, temporary-storage use and a conservative expected output size before work begins.
4. Keep capture local and cancellable. Cancellation or failure removes staging output and never changes a previously ready range.
5. Promote an extracted clip only after its actual duration, MIME type, byte size and exact originating range identity pass validation. A timing mismatch remains an explicit error, never a silently shifted transcript.
6. Attach the validated provider-ready clip to the existing C1 queue without recording consent or uploading anything.
7. Add deterministic capability/estimate/validation/recovery evaluations and a permanent contract.
8. Add a Chromium proof for local extraction → C1 queue → provider mock → merged draft, with no source chunks created automatically.

### C2 verification

Steps 1–8 are complete. The browser path is capability-gated, local-only, staged, cancellable and validated before it reaches the existing C1 queue. PR #51 head `4b804c6` passed the two-second WAV Chromium proof, its contract, deterministic evaluations, typecheck, lint and production build. Its complete CI, Automatic Transcription, Resumable Transcription, Long Lecture Media and Exam Engine regression workflows also passed.

The browser proof exposed and resolved two real capture edge cases: decoder/audio-track readiness and a recorder-produced WebM without finite duration metadata. The final path probes the local container and otherwise validates the observed 1× source-capture clock; it never fabricates the requested duration. The manual C1 fallback remains visible throughout.

## Subsequent delivery

1. Add streaming backup/export for raw media, editable drafts, provider candidates and range queues.
2. Validate real Hebrew/Russian lecture quality on licensed audio and record latency/cost.
3. Extend Exam Engine with profile, topic weights and bounded daily planning.
4. Continue `P1-015`–`P1-019` only through source-visible and reviewable contracts.
