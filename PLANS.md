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

## Active delivery — P1-013 Concept graph and evidence model v1

**Status:** implemented on `agent/concept-evidence-v1`; verification pending.

### Product outcome

A course gains an inspectable map of concepts and learning evidence without replacing uncertainty with a decorative mastery percentage.

### Implementation sequence

1. Add a separate local-first concept/evidence schema without rewriting `lamdan.data.v1`. ✓
2. Normalize missing or malformed concept data safely. ✓
3. Allow manual concept creation and explicit links to topics, approved chunks, cards and quiz questions. ✓
4. Capture linked flashcard outcomes as recall evidence. ✓
5. Preserve aggregate quiz attempts as neutral context rather than invented concept correctness. ✓
6. Add explicit explanation/application checks and editable mistake taxonomy. ✓
7. Derive `unseen`, `covered`, `fragile`, `weak` and `strong` states from deterministic evidence rules. ✓
8. Make every evidence event inspectable and removable. ✓
9. Reconcile dangling references after course/source/practice deletion. ✓
10. Add course-level concept JSON export/import. ✓
11. Add Course Workspace UI, deterministic evals, permanent contract and CI wiring. ✓
12. Run typecheck, lint, build, all existing contracts/evals and critical browser E2E. Pending.
13. Review desktop/mobile behavior and merge only after all gates pass. Pending.

### Explicit boundaries

- File views, note creation and time spent never create learning evidence.
- One correct answer or one flashcard result cannot create `strong` state.
- Strong evidence requires at least four successes across at least two days and two evidence kinds.
- Existing aggregate quiz attempts remain `mixed` context until per-question answers are persisted.
- Manual explanation/application events are explicitly labeled self-recorded evidence.
- No mastery percentage, score prediction or exam-readiness score.
- Concept JSON export is visible; full visual ZIP integration is a follow-up.

## Next delivery after P1-013

1. Persist per-question quiz answer evidence and mistake review.
2. Add reviewed concept extraction from source chunks and Study Packs.
3. Integrate concept/evidence data into full visual ZIP backup.
4. Build `P1-014 Exam Engine` on stable evidence, source coverage and deadlines.
5. Continue `P1-015`–`P1-019` only through the same source-visible and reviewable contracts.
