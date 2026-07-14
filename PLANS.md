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
- `P1-013A Per-question quiz evidence` — merged in PR #39 after deterministic and Chromium persistence gates.
- `P1-013B Workspace backup v2` — merged in PR #41 after contracts, deterministic evals, TypeScript, lint, build and three Chromium gates.
- `P1-013C Reviewed concept extraction` — merged in PR #42 after contracts, deterministic evals, TypeScript, lint, build and four Chromium gates.
- `P1-013D Open-answer evidence and mistake repair` — merged in PR #43 after contracts, deterministic evals, TypeScript, lint, build and five Chromium gates.

## Active delivery — Final edited-batch concept collision guard

### Product outcome

Manual edits made inside the concept review queue cannot create a duplicate concept by colliding a title with another title or alias immediately before acceptance.

### Delivery sequence

1. Add a pure final acceptance planner that re-normalizes every selected candidate. ✓
2. Compare full title+alias key sets against the current course knowledge map. ✓
3. Compare full title+alias key sets against earlier accepted candidates in the same batch. ✓
4. Reject stale source relationships at the final persistence boundary. ✓
5. Expose `invalid`, `duplicate_existing` and `duplicate_batch` reasons. ✓
6. Recalculate visible collision warnings after every manual edit. ✓
7. Rerun the same guard immediately before writing concepts. ✓
8. Allow valid candidates to save while rejected candidates remain editable. ✓
9. Add deterministic alias→title, alias→alias, existing-alias and stale-source regression coverage. ✓
10. Pass all contracts, evals, TypeScript, lint, build and five browser gates. Pending.
11. Merge only after every gate passes. Pending.

### Non-negotiable boundaries

- The persisted concept map remains the final source of truth.
- A title or alias cannot collide with any current course concept.
- A later selected candidate cannot collide with a title or alias of an earlier accepted candidate.
- Source-less or stale-source candidates cannot be accepted.
- Rejected candidates are not silently deleted and remain available for correction.
- Accepting candidates still creates no learning evidence.

## Next delivery after collision hardening

1. Build `P1-014 Exam Engine` on stable evidence, source coverage and deadlines.
2. Continue `P1-015`–`P1-019` only through source-visible and reviewable contracts.
