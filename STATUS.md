# Lamdan — Current execution status

Last updated: 2026-07-12

## Current milestone

**Milestone G — Validation and release readiness**

## Task status

- `P0-001 Add continuous integration` — complete and verified.
- `P0-002 Audit and normalize all active routes` — complete for the current shell.
- `P0-003 Remove tracking-first product flows` — complete in primary navigation and the course workspace.
- `P0-004 Create one shared intake service` — complete and verified.
- `P0-005 Build multi-file upload queue` — complete and verified on Dashboard and Materials.
- `P0-006 Add duplicate detection` — complete and verified across exact, likely, queue and legacy upload paths.
- `P0-007 Add intake review and correction` — complete and verified.
- `P0-008 Replace material detail with a true workspace` — complete and verified.
- `P0-009 Add chunk editing tools` — complete and verified.
- `P0-010 Add material output history` — complete and verified.
- `P0-011 Connect AI actions to material selection` — complete and verified.
- `P0-012 Upgrade AI draft review` — complete and verified.
- `P0-013 Add AI trust and citation layer` — complete and verified.
- `P0-014 Complete syllabus review and confirmation` — complete and verified.
- `P0-015 Build Course Workspace v1` — complete and verified.
- `P0-016 Upgrade Notes to a reliable editor` — complete and verified.
- `P0-017 Add Flashcard Studio v1` — complete and verified.
- `P0-018 Add Quiz Studio v1` — complete and verified.
- `P0-019 Remove remaining fake and disconnected UI` — complete and verified.
- `P0-020 Create evaluation fixtures` — complete and verified.
- `P0-021 Add durable image intake and OCR review` — next.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Deterministic evaluation and OCR readiness

- Added a versioned offline evaluation manifest with explicit per-suite thresholds.
- Added deterministic scoring for structured syllabus extraction, grounded generation and multilingual terminology preservation.
- Added recorded positive baselines plus deliberately bad negative controls; CI fails if a negative control passes.
- Added OCR fixtures for printed Hebrew, handwritten Hebrew, handwritten mathematics and unreadable-photo abstention.
- Added OCR metrics for character error rate, word error rate, critical-token recall, math-expression recall, line order and hallucinated-token rate.
- Added explicit review and abstention gates so handwriting and unreadable photos cannot pass by returning confident invented text.
- Added support for external candidate directories so private or licensed real-photo packs can be evaluated without committing personal notebook images.
- Added a typed OCR/HTR draft contract with ordered regions, source style, languages, bounding boxes, confidence, uncertain tokens, warnings and normalized mathematics.
- Added normalization, validation and OCR-region-to-material-chunk helpers for the future live provider integration.
- Documented the OCR pipeline, handwriting-specific risks, math preservation rules, durable image-storage boundary and privacy policy.
- Added `npm run eval`, `npm run eval:ocr`, `npm run eval:json` and `npm run verify:evaluation-fixtures`.
- Added fixture verification and deterministic evaluation to canonical local checks and CI.
- Did not claim live OCR support: the current task creates the benchmark and integration contract, while actual photo storage/provider/review UI remains P0-021.

## Verification state

- Documentation verification passed.
- Selected-source AI contract verification passed.
- Syllabus review and confirmation contract verification passed.
- Course Workspace v1 contract verification passed.
- Reliable Notes editor contract verification passed.
- Flashcard Studio v1 contract verification passed.
- Quiz Studio v1 contract verification passed.
- Core UI honesty and actionability contract verification passed.
- Evaluation fixture coverage verification passed.
- Deterministic syllabus, grounding, multilingual and OCR evaluation suites passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.

## Next execution target

1. Add durable local image storage so a photographed page survives reload and can be retried.
2. Connect a multimodal OCR/HTR provider behind the `ocr-contract.ts` boundary.
3. Build a correction screen with image regions, confidence, uncertain tokens and mixed RTL/LTR support.
4. Preserve both visible handwritten math and normalized expressions before creating material chunks.
5. Run the live provider against a private real-photo pack and require the P0-020 thresholds before release.

## Blockers

- Live OCR requires a deliberate provider choice and durable image/blob storage; neither is faked in the current build.
