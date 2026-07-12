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
- `P0-022 Validate live OCR and harden visual-source reliability` — in progress; lifecycle and backup honesty complete.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Visual-source lifecycle and backup honesty

- Added IndexedDB storage statistics for original images and OCR drafts.
- Added explicit full-clear and orphan-pruning operations for browser-local visual data.
- Added an application-level lifecycle janitor that removes image and OCR records after their material is deleted, reset or replaced by imported data.
- Preserved the original visual-source creation timestamp when a source image is replaced.
- Made the Data page show the number and total size of browser-local photographs and OCR drafts.
- Made JSON backup limitations explicit: applied OCR text and relationships are exported, but original image blobs and separate OCR drafts are not yet included.
- Made destructive JSON import explicitly clear current browser-local images and OCR drafts after confirmation.
- Made full reset delete localStorage text data and IndexedDB visual data together.
- Updated the core UI and OCR contracts so lifecycle deletion and backup disclosure cannot silently regress.

### Durable image intake and reviewed OCR/HTR

- OCR, handwriting and photographed mathematics are part of core universal intake and Material Workspace phases.
- JPEG, PNG and WebP intake works through the shared queue.
- Original images and OCR drafts are stored separately from approved searchable text.
- Multimodal OCR/HTR has a strict server boundary and editable review workflow.
- Reviewed regions can become normal material chunks only through an explicit apply action.

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
- Durable image intake, OCR review, lifecycle cleanup and backup-honesty contract verification passed.
- Deterministic syllabus, grounding, multilingual and OCR evaluation suites passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.

## Next execution target

1. Run the connected multimodal provider against a private real-photo pack: printed Hebrew, Hebrew handwriting, mixed RTL/LTR and photographed mathematics.
2. Save provider candidates and enforce the P0-020 CER, WER, critical-token, math-expression, line-order and abstention thresholds.
3. Add image crop, rotation, deskew and contrast preparation for difficult phone photographs.
4. Add region-coordinate overlays so selecting OCR text highlights the exact image area.
5. Build a real visual backup format or cloud migration that includes original image blobs.

## Blockers

- Code, contracts, typecheck, lint and production build pass, but real OCR quality is not yet verified because the repository intentionally contains no private student notebook photographs.
