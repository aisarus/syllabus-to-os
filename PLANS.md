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

- `P1-011 Study Command Center v1` — merged in PR #36.
- `P1-012 Lecture-to-Study-Pack` — merged in PR #37.
- `P1-013 Concept graph and evidence model v1` — merged in PR #38.
- `P1-013A Per-question quiz evidence` — merged in PR #39.
- `P1-013B Workspace backup v2` — merged in PR #41.
- `P1-013C Reviewed concept extraction` — merged in PR #42.
- `P1-013D Open-answer evidence and mistake repair` — merged in PR #43.
- `P1-013E Edited-batch concept collision guard` — merged in PR #44.
- `P1-014A Frozen source-grounded Exam Engine v1` — merged in PR #45.

## Active delivery — Whole-lecture media

### P1-010A — Durable whole-lecture audio/video intake

**Status:** implemented; validation pending.

### Product outcome

A user can upload one complete audio or video lecture, keep it locally across reloads, play it, import or edit a timestamped transcript, and explicitly approve transcript segments before they become source chunks.

### Delivered sequence

1. Separate the media path from ordinary document extraction. ✓
2. Validate common audio/video MIME types and extensions. ✓
3. Enforce an explicit 4 GB local per-file boundary. ✓
4. Write the browser `File` sequentially in 8 MB IndexedDB chunks. ✓
5. Check available browser quota and request persistent storage before the write. ✓
6. Keep replacement uploads under a staging `uploadId` until every chunk succeeds. ✓
7. Preserve the previous complete file after cancellation or write failure. ✓
8. Record and verify SHA-256 for every stored chunk. ✓
9. Reconstruct a local audio/video player only after explicit user action. ✓
10. Import SRT, WebVTT or plain-text transcript drafts. ✓
11. Create editable ten-minute timestamp blocks when no transcript is available. ✓
12. Require explicit approval for each source segment. ✓
13. Convert only approved non-empty segments into source-integrity-aware `MaterialChunk` records. ✓
14. Add navigation, material-detail integration, orphan cleanup and Data-page storage boundary. ✓
15. Add deterministic file/segment/import/apply evaluations. ✓
16. Add a Chromium proof using a real 18 MB file written as three IndexedDB chunks. ✓
17. Pass the complete repository and dedicated long-media CI. Pending.
18. Merge only after every applicable gate passes. Pending.

### Non-negotiable boundaries

- Selecting, storing or playing a recording never uploads it to external AI.
- Provider output may not become a trusted transcript automatically.
- An incomplete staging upload cannot become the active lecture file.
- Draft and empty transcript segments cannot become source chunks.
- Replacing a recording invalidates its old editable transcript draft.
- Very large playback may require substantial browser memory and is never auto-loaded.
- Workspace ZIP v2 does not claim to contain the raw multi-gigabyte recording or editable transcript draft.
- The user must keep the original recording separately until streaming backup exists.

### P1-010B — Reviewed automatic transcription

**Status:** next implementation slice after P1-010A is verified.

Planned boundaries:

1. Explicit user action and provider disclosure before any upload.
2. Resumable jobs over bounded time ranges instead of one opaque request.
3. Cancellation, retry and partial-success persistence.
4. Timestamps, language and uncertainty retained in every returned block.
5. AI output remains an editable draft.
6. No transcript block becomes a source until human approval.
7. Source-visible failure states for missing or unintelligible intervals.
8. No hidden recording upload during ordinary local playback or storage.

## Subsequent delivery

1. Extend Exam Engine with profile, topic weights and bounded daily planning.
2. Design a streaming backup/export path for raw long media and editable transcript drafts.
3. Continue `P1-015`–`P1-019` only through source-visible and reviewable contracts.
