# Lamdan implementation plans

This file records the active implementation plan. Product intent remains in `ROADMAP.md`; canonical task status and acceptance criteria live in `TASKS.md`; evidence and blockers live in `STATUS.md`.

## P1-005 — Store persistence and source-integrity hardening

**Status:** complete in the current branch; awaiting full CI.

### Delivered

1. Detect divergence between in-memory state and the exact browser-local snapshot.
2. Warn persistently, retry safely and allow emergency JSON export.
3. Make the Notes editor's existing save state fail honestly when localStorage rejects a write.
4. Preserve stable chunk ids during ordinary OCR replacement.
5. Repair legacy and multi-page source references after chunk churn.
6. Cover notes, flashcards, quiz questions and presentation slides.
7. Add deterministic evals and permanent CI contract wiring.
8. Replace stale task documentation with the active validation sequence.
9. Add a private live-OCR runner without committing private images.

## Active plan — P1-006 to P1-008

1. Place four private/licensed images in `private-ocr-assets/`.
2. Run `npm run eval:ocr:live` against a connected Lamdan preview.
3. Classify and fix live OCR failure categories.
4. Generate one golden quiz from a complete Hebrew source pack and review every question.
5. Promote an approved quiz candidate into permanent fixtures.
6. Run the complete one-course pilot in `PILOT.md`.
7. Fix every critical data-loss, provenance or mobile blocker before declaring M1.
