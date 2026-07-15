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

- `P1-010A Durable whole-lecture audio/video intake` — verified in PR #46; merge pending final documentation-head CI.
- `P1-011 Study Command Center v1` — merged in PR #36.
- `P1-012 Lecture-to-Study-Pack` — merged in PR #37.
- `P1-013 Concept graph and evidence model v1` — merged in PR #38.
- `P1-013A Per-question quiz evidence` — merged in PR #39.
- `P1-013B Workspace backup v2` — merged in PR #41.
- `P1-013C Reviewed concept extraction` — merged in PR #42.
- `P1-013D Open-answer evidence and mistake repair` — merged in PR #43.
- `P1-013E Edited-batch concept collision guard` — merged in PR #44.
- `P1-014A Frozen source-grounded Exam Engine v1` — merged in PR #45.

## Verified delivery — P1-010A whole-lecture media

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
20. Merge after the final documentation-head rerun. Pending.

### Non-negotiable boundaries

- Selecting, storing or playing a recording never uploads it to external AI.
- Provider output may not become a trusted transcript automatically.
- An incomplete staging upload cannot become the active lecture file.
- Draft and empty transcript segments cannot become source chunks.
- Replacing a recording invalidates its old editable transcript draft.
- Very large playback may require substantial browser memory and is never auto-loaded.
- Workspace ZIP v2 does not claim to contain the raw multi-gigabyte recording or editable transcript draft.
- The user must keep the original recording separately until streaming backup exists.

## Active next delivery — P1-010B reviewed automatic transcription

### Product outcome

A user explicitly chooses to send a long recording for transcription, can see which provider receives it, can cancel and resume bounded transcription work, and reviews every returned timestamped block before it becomes a Lamdan source.

### Planned sequence

1. Inspect the existing server/provider abstraction and official long-file APIs.
2. Choose a provider path that does not silently proxy a multi-gigabyte recording through an unsuitable request body.
3. Add an explicit consent screen naming provider, file, size and retention boundary before upload.
4. Split transcription into bounded time ranges or resumable provider jobs.
5. Persist local job state, provider file/job identifiers, completed ranges and retry state without storing secrets.
6. Support cancellation, retry and partial-success recovery.
7. Preserve timestamps, language, speaker labels when available and uncertainty/missing-audio intervals.
8. Store provider output only as an editable transcript draft.
9. Require human approval before any block becomes a source chunk.
10. Keep existing approved transcript/source chunks unchanged after provider failure, cancellation or retry.
11. Add deterministic job-state and source-integrity evaluations.
12. Add browser proof for explicit consent, partial result, cancellation/resume, review and apply.
13. Merge only after provider contract, types, lint, build and browser gates pass.

### Non-negotiable boundaries

- No hidden upload during local storage, playback, integrity checking or ordinary material navigation.
- The exact external provider is shown before upload.
- Cancelled or failed provider work cannot replace the current approved transcript.
- Provider text remains untrusted draft content until explicit review.
- Missing or unintelligible intervals remain visible instead of being filled from model memory.
- Secrets and provider credentials remain server-side.

## Subsequent delivery

1. Extend Exam Engine with profile, topic weights and bounded daily planning.
2. Design a streaming backup/export path for raw long media and editable transcript drafts.
3. Continue `P1-015`–`P1-019` only through source-visible and reviewable contracts.
