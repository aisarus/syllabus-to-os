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

- `P1-011 Study Command Center v1` — merged in PR #36 after full CI and critical Chromium E2E.
- `P1-012 Lecture-to-Study-Pack` — merged in PR #37 after full CI and critical Chromium E2E.
- `P1-013 Concept graph and evidence model v1` — merged in PR #38 after full CI, CodeRabbit and critical Chromium E2E.
- `P1-013A Per-question quiz evidence` — full CI, critical Chromium and dedicated reload/persistence Chromium proof passed in PR #39.

## Verified delivery — P1-013 / P1-013A evidence foundation

### Product outcome

A course gains an inspectable map of concepts and learning evidence without replacing uncertainty with a decorative mastery percentage. New quiz attempts preserve immutable question-level history and produce objective recognition evidence only for explicitly linked questions.

### Delivered sequence

1. Separate local-first concept/evidence schema without rewriting `lamdan.data.v1`. ✓
2. Safe normalization and dangling-reference repair. ✓
3. Manual concepts linked to topics, approved chunks, cards and quiz questions. ✓
4. Linked flashcard outcomes as recall evidence. ✓
5. Historical aggregate quiz attempts as neutral context. ✓
6. Immutable per-question answer snapshots for new attempts. ✓
7. Linked question answers as objective recognition success/failure evidence. ✓
8. Explicit explanation/application checks and editable mistake taxonomy. ✓
9. Deterministic `unseen`, `covered`, `fragile`, `weak` and `strong` states. ✓
10. Inspectable/removable evidence history and visible forgetting risk. ✓
11. Course-level concept JSON export/import. ✓
12. Dedicated Chromium proof for aggregate attempt, detail snapshot, recognition event and reload without duplication. ✓
13. All contracts, evals, typecheck, lint, build and browser gates. ✓

### Explicit boundaries

- File views, note creation and time spent never create learning evidence.
- One correct answer, one flashcard result or repeated manual self-rating cannot create `strong` state.
- Strong evidence requires at least four successes, including at least two non-manual successes, across at least two days and two evidence kinds.
- Old aggregate attempts remain `mixed` because historical per-question choices cannot be reconstructed.
- Wrong multiple-choice answers default to `unclassified`; no hidden inference of confusion or carelessness.
- No mastery percentage, score prediction or exam-readiness score.
- Concept and attempt-detail stores are not yet included in the full visual ZIP backup.

## Active next delivery

1. Integrate concept/evidence and per-question attempt-detail stores into full visual ZIP backup with checksums, preview and rollback.
2. Remove the completed per-question item from the remaining `P1-013` task scope.
3. Add reviewed concept extraction from source chunks and Study Packs.
4. Add open-answer evidence and mistake-repair flows.
5. Build `P1-014 Exam Engine` on stable evidence, source coverage and deadlines.
6. Continue `P1-015`–`P1-019` only through the same source-visible and reviewable contracts.
