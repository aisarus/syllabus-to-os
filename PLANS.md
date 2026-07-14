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

## Active delivery — Workspace backup v2

### Product outcome

One verified ZIP transfers or restores the complete local Lamdan workspace: core entities, original and processed visual sources, OCR drafts, concept relationships, evidence history and immutable per-question answers.

### Delivery sequence

1. Keep the mature visual backup v1 engine intact and nest it inside a v2 workspace container. ✓
2. Add separate checksummed concept-evidence and attempt-detail payloads. ✓
3. Validate paths, kinds, sizes, SHA-256 and expansion limits before mutation. ✓
4. Support legacy visual ZIP v1 with explicit missing-evidence semantics. ✓
5. Show evidence counts and merge conflicts in preview. ✓
6. Preserve current duplicate IDs and skip evidence for conflicting concepts. ✓
7. Reconcile imported evidence against the actual resulting core workspace. ✓
8. Roll back core localStorage, visual IndexedDB, concept evidence and attempt details together. ✓
9. Update Data Management and Clear All for all four layers. ✓
10. Add deterministic archive, tamper, legacy and conflict evaluations. ✓
11. Add browser proof for replace, checksum rejection, forced write failure, rollback and reload. ✓
12. Pass all contracts, evals, TypeScript, lint, build and three browser gates. In progress.
13. Merge only after every gate passes. Pending.

### Non-negotiable boundaries

- No store changes before all outer checksums pass.
- Legacy merge preserves current evidence; legacy replace clears it only after explicit confirmation.
- Duplicate concept, event and attempt-detail IDs never overwrite current records in merge mode.
- Evidence from an imported conflicting concept is not attached to the current concept.
- Any apply failure triggers rollback across all four storage layers.
- Lightweight JSON remains explicitly incomplete.
- No server upload, cloud copy or background sync is introduced.

## Next delivery after Workspace backup v2

1. Add reviewed concept extraction from source chunks and Study Packs.
2. Add open-answer evidence and mistake-repair flows.
3. Build `P1-014 Exam Engine` on stable evidence, source coverage and deadlines.
4. Continue `P1-015`–`P1-019` only through source-visible and reviewable contracts.
