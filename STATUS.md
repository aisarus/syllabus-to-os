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
- `P0-021 Add durable image intake and OCR review` — complete and verified.
- `P0-022 Validate live OCR and harden visual-source reliability` — next.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Durable image intake and reviewed OCR/HTR

- Moved OCR, handwriting and photographed mathematics from a late optional phase into the core universal-intake and Material Workspace roadmap.
- Added JPEG, PNG and WebP intake from Dashboard and Materials through the existing multi-file queue.
- Added durable browser-local IndexedDB storage for original images and OCR drafts, separate from localStorage text entities.
- Added honest image-intake review with a source preview before material persistence.
- Added browser image preparation with orientation-aware decoding, edge resizing and payload limits.
- Added a multimodal server boundary and `/api/ai/ocr-image` route using the existing Lovable AI Gateway configuration.
- Added strict OCR/HTR prompting for printed Hebrew, handwriting, whiteboards, mixed RTL/LTR pages and photographed mathematics.
- Explicitly forbade solving exercises, completing unreadable text or inventing mathematical symbols and steps.
- Added side-by-side source-image and OCR-region review inside the material flow.
- Added editable region type, text, order, confidence display, uncertain tokens and normalized mathematical expressions.
- Added manual transcription when the AI provider is unavailable or the user prefers to transcribe directly.
- Kept OCR output as a separate draft until the user explicitly applies it.
- Applying an approved draft creates normal material chunks and updates searchable source text without silently overwriting it during OCR reruns.
- Added a permanent `verify:image-ocr-contract` check to local verification and CI.
- Rewrote `ROADMAP.md` so OCR/HTR belongs to Phases 1–2; Phase 7 now covers audio, video and advanced visual understanding.

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
- Durable image intake and OCR review contract verification passed.
- Deterministic syllabus, grounding, multilingual and OCR evaluation suites passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.

## Next execution target

1. Run the connected multimodal provider against a private real-photo pack: printed Hebrew, Hebrew handwriting, mixed RTL/LTR and photographed mathematics.
2. Save provider candidates and enforce the P0-020 CER, WER, critical-token, math-expression, line-order and abstention thresholds.
3. Add image crop, rotation, deskew and contrast preparation for difficult phone photographs.
4. Add region-coordinate overlays so selecting OCR text highlights the exact image area.
5. Make material deletion and full-data reset remove corresponding IndexedDB image and OCR records.
6. Document and surface that current JSON backup does not yet include original image blobs.

## Blockers

- Code, contracts, typecheck, lint and production build pass, but real OCR quality is not yet verified because the repository intentionally contains no private student notebook photographs.
