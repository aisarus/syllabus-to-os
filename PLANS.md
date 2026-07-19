# Lamdan implementation plans

This file records the active implementation plan. Product intent remains in `ROADMAP.md`; canonical task status and acceptance criteria live in `TASKS.md`; evidence and blockers live in `STATUS.md`.

## Active production Phase 1 — stabilization

**Branch:** `agent/production-phase-1-stabilization`

1. Reconcile execution documents with merged main through PR #72.
2. Make local workspace writes durable-before-publish and regression-test quota failure.
3. Replace import-order method mutation with an explicit repository boundary and base-store source integrity.
4. Add shared runtime validation and bounded AI/OCR/transcription execution.
5. Add real running-job cancellation and accessibility baseline.
6. Execute the one-course pilot when licensed external fixtures are supplied.

No cloud backend, broad redesign or new product surface enters this phase.

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
- `P1-010C1 Resumable provider-range queues` — merged and verified in PR #48.
- `P1-010C2 Automatic local range extraction/transcoding` — merged and verified in PR #52.
- `P1-010C3 Streaming lecture backup` — merged and verified in PR #53.
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

### Delivered sequence on PR #48

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

### Historical C1 boundary

C1 deliberately did not claim automatic extraction from the local multi-gigabyte original. The user selected provider-ready clips matching the exact displayed ranges. P1-010C2 replaces that limitation with locally generated, persisted clips while keeping manual selection as a fallback.

### Non-negotiable boundaries

- No original or range clip uploads without explicit consent.
- A completed range cannot be erased by an unrelated failed range.
- Provider timestamps must remain inside the displayed range and lecture duration.
- Missing ranges remain visible.
- Merged output remains an editable draft.
- No provider range result becomes a source chunk automatically.

## Verified delivery — P1-010C2 Automatic local range extraction/transcoding

1. Inspect browser media APIs and choose a bounded local extraction strategy. ✓
2. Show CPU, memory, temporary-storage and expected-output estimates before work begins. ✓
3. Extract audio without changing playback speed or lecture timing. ✓
4. Produce clips matching the exact persisted C1 range boundaries and overlap. ✓
5. Keep extraction local, persisted and cancellable. ✓
6. Verify encoded clip duration, MIME type, size and source/range identity before provider consent. ✓
7. Avoid reading a multi-gigabyte original into one in-memory buffer. ✓
8. Add browser proof for extraction → range queue → provider mock → merged draft. ✓
9. Reject decoder errors, stalled playback and inactive timelines instead of hanging indefinitely. ✓
10. Reject or time out pending Chrome DevTools commands in the browser proof. ✓
11. Localize unsupported-extraction reasons in RU/EN UI. ✓
12. Preserve manual provider-ready clip selection as a fallback. ✓
13. Pass dedicated C2 checks plus the separate C1 resumable regression on the final human-authored head. ✓
14. Merge PR #52. ✓

## Verified delivery — P1-010C3 Streaming lecture backup

### Product outcome

A student can export one complete long-media material directly to a user-selected file without reconstructing the multi-gigabyte recording as one JavaScript Blob or ArrayBuffer.

1. Define a deterministic framed `.lamdan-lecture` v1 format with a fixed signature. ✓
2. Include the core material, media manifest, raw chunks, editable transcript, provider candidate, resumable queue and local range clips. ✓
3. Fetch and hash one existing IndexedDB payload at a time. ✓
4. Write directly through the native Save File picker with no JSZip or giant-Blob fallback. ✓
5. Store exact byte size and SHA-256 for every payload. ✓
6. Re-read and re-hash each prepared payload before writing. ✓
7. Abort the writable stream on cancellation, hash drift or source replacement. ✓
8. Add an incremental inspector for framing, order, checksums and trailing bytes. ✓
9. Expose RU/EN planning, size metrics, progress and cancellation in material detail. ✓
10. Add deterministic manifest and corruption evaluations. ✓
11. Add Chromium proof for three raw chunks plus all companion record kinds and bounded writes. ✓
12. Pass full CI and existing long-media, extraction, transcription and Exam Engine regressions. ✓
13. Merge PR #53. ✓

## Active delivery — P1-010C4 Staged streaming lecture restore (PR #54)

### Product outcome

A student can restore a verified `.lamdan-lecture` bundle as a new independent long-media material without replacing existing lectures or loading the complete recording into memory.

1. Verify the fixed signature, framed headers, exact EOF, payload sizes and every SHA-256 before publication. ✓
2. Allocate new material and upload identities and always restore as a duplicate. ✓
3. Stage raw media chunks one at a time under the new upload identity. ✓
4. Stage local range clips and rewrite transcript, provider-candidate and resumable-queue identities. ✓
5. Publish the media manifest only after complete archive consumption and publish the visible core material last. ✓
6. Roll back raw chunks, manifest, transcript, provider candidate, queue, clips and core material after cancellation or failure. ✓
7. Preserve provider text as candidate/draft only and never create source chunks automatically. ✓
8. Add RU/EN Data-page preview, editable restored title, progress and cancellation. ✓
9. Add deterministic valid, corrupt, truncated and trailing-byte archive evaluations. ✓
10. Add Chromium proof for export → SPA Data route → verified restore → new identities → reload. ✓
11. Pass full CI and existing backup, long-media, extraction, transcription and Exam Engine regressions. In verification.
12. Merge PR #54. Pending.

## Subsequent delivery

1. Validate real Hebrew/Russian lecture quality on licensed audio and record latency/cost.
2. Extend Exam Engine with profile, topic weights and bounded daily planning.
3. Continue `P1-015`–`P1-019` only through source-visible and reviewable contracts.
