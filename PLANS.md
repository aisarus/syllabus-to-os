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
12. Create editable ten-minute timestamp blocks when no transcript is available. ✓
13. Require explicit approval for each source segment. ✓
14. Convert only approved non-empty segments into source-integrity-aware `MaterialChunk` records. ✓
15. Add navigation, material-detail integration, guarded orphan cleanup and Data-page storage boundary. ✓
16. Add deterministic file/segment/import/apply evaluations. ✓
17. Repair the Cloudflare production preview path and async IndexedDB browser predicate. ✓
18. Pass a real Chromium proof using an 18 MB file written as three IndexedDB chunks, SHA-checked, transcribed from SRT, applied as two source chunks and reloaded. ✓
19. Pass complete repository CI and the dedicated Exam Engine regression on the same final head. ✓
20. Merge PR #46. ✓

### Non-negotiable boundaries

- Selecting, storing or playing a recording never uploads it to external AI.
- Provider output may not become a trusted transcript automatically.
- An incomplete staging upload cannot become the active lecture file.
- Draft and empty transcript segments cannot become source chunks.
- Replacing a recording invalidates its old editable transcript draft.
- Very large playback may require substantial browser memory and is never auto-loaded.
- Workspace ZIP v2 does not claim to contain the raw multi-gigabyte recording or editable transcript draft.
- The user must keep the original recording separately until streaming backup exists.

## Active delivery — P1-010B Reviewed automatic transcription v1

### Product outcome

A user explicitly chooses to send one provider-ready recording copy for transcription, sees which provider/model/file receives it, can cancel and retry, inspects timestamp gaps and uncertain speaker-labelled segments, and loads the result only as an unapproved editable draft.

### Implemented sequence on PR #47

1. Inspect the existing server/provider abstraction and official audio-transcription boundary. ✓
2. Keep the built-in local/manual workflow fully usable without an external transcription provider. ✓
3. Add an optional OpenAI Audio Transcriptions server adapter with server-only `OPENAI_API_KEY`. ✓
4. Cap one provider request at 24 MB and validate supported formats before upload. ✓
5. Allow a separately selected compressed provider copy while keeping the large local original private. ✓
6. Add an explicit consent surface naming provider, model, exact file and size. ✓
7. Guarantee that navigation, playback, SHA checking and manual transcript work trigger no provider upload. ✓
8. Persist local job status, attempt count, provider request id and returned candidate without secrets. ✓
9. Support cancellation, retry and interrupted-tab recovery. ✓
10. Reject a result tied to an older lecture `sourceUploadId`. ✓
11. Preserve timestamps, language, speaker labels and provider uncertainty warnings. ✓
12. Surface uncovered time ranges instead of filling missing speech from model memory. ✓
13. Keep provider output outside the current transcript until a separate user action. ✓
14. Load every provider segment into the editor with `status: "draft"`. ✓
15. Keep already applied source chunks unchanged after failure, cancellation, retry or draft loading. ✓
16. Include provider candidates in local data controls and guarded orphan cleanup. ✓
17. Add deterministic job-state, stale-upload, gap and source-integrity evaluations. ✓
18. Add browser proof for consent → cancel → retry → candidate → draft-only load → reload. In verification.
19. Pass complete CI, Exam Engine and long-media regressions on one final head. Pending.
20. Merge PR #47. Pending.

### Current bounded scope

This first provider slice deliberately does not pretend that a 4 GB original can be posted through a normal request body. The original may be stored locally up to 4 GB, but one automatic provider request is at most 24 MB. A larger lecture requires a user-created compressed complete-lecture copy.

### Non-negotiable boundaries

- No hidden upload during local storage, playback, integrity checking or ordinary material navigation.
- The exact external provider, model, file and size are shown before upload.
- Cancelled or failed provider work cannot replace the current transcript or source chunks.
- Provider text remains an untrusted candidate until explicitly loaded into the editor.
- Loaded provider blocks remain `draft` until individually reviewed and approved.
- Missing or unintelligible intervals remain visible instead of being filled from model memory.
- Secrets and provider credentials remain server-side.
- A stale candidate from a replaced recording cannot be applied.
- Workspace ZIP v2 does not claim to contain provider candidates.

## P1-010C Subsequent long-file provider work

1. Add local audio extraction/transcoding with explicit CPU/storage estimates.
2. Split long audio on time boundaries without changing playback speed.
3. Persist a resumable range/job queue for provider requests.
4. Merge partial results while preserving uncovered/failed ranges.
5. Add provider-aware retry/backoff and per-range cancellation.
6. Add streaming backup/export for raw media, editable drafts and provider candidates.
7. Validate real Hebrew/Russian lecture quality on licensed audio and record latency/cost.

## Subsequent delivery

1. Extend Exam Engine with profile, topic weights and bounded daily planning.
2. Design a streaming backup/export path for raw long media and editable transcript drafts.
3. Continue `P1-015`–`P1-019` only through source-visible and reviewable contracts.
