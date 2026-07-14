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
- `P1-013D Open-answer evidence and mistake repair` — verified in PR #43 after contracts, deterministic evals, TypeScript, lint, build and five Chromium gates.

## Verified delivery — Open-answer evidence and mistake repair

### Product outcome

Lamdan can store a complete explanation or application answer as inspectable evidence, optionally obtain a source-grounded AI review, require the user to confirm the final judgment, and preserve later mistake-repair attempts without rewriting the original failure.

### Delivered sequence

1. Extended the evidence schema with full prompt, response, reviewed source chunks and review mode. ✓
2. Added additive `repairOfEvidenceId` links that retain the original failure. ✓
3. Reconciled deleted sources and orphan repair links safely. ✓
4. Kept human-only open answers secondary; only confirmed source-grounded AI+human reviews may count as non-manual. ✓
5. Added strict source-only AI review generation and API route. ✓
6. Rejected short, uncited and stale-source answers before persistence. ✓
7. Added course UI for explanation/application prompts, full responses and source selection. ✓
8. Required explicit human confirmation of outcome, score, mistake type and reviewed sources. ✓
9. Added failure list, repair workflow and inspectable/removable history. ✓
10. Added deterministic review, objective-evidence, reconciliation and repair-link evaluations. ✓
11. Added Chromium proof for failure → linked repair → reload with both events preserved. ✓
12. Wired permanent contracts, canonical checks and CI. ✓
13. Passed all contracts, evals, TypeScript, lint, build and five browser gates. ✓

### Non-negotiable boundaries

- AI review is advisory and never auto-saves.
- The model may judge only against explicitly selected current concept source chunks.
- The user must confirm the final outcome, score, mistake type and source selection.
- Human-only success remains secondary evidence.
- A confirmed source-grounded AI+human review may count as non-manual, but one answer can never create `strong` state.
- Repair creates a new event and never overwrites the original failure.
- Removing the reviewed source relationship invalidates the affected evidence.
- Full prompt, response, review and repair link remain inspectable and removable.

## Active next delivery

1. Add the final edited-batch alias collision guard.
2. Build `P1-014 Exam Engine` on stable evidence, source coverage and deadlines.
3. Continue `P1-015`–`P1-019` only through source-visible and reviewable contracts.
