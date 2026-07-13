# Lamdan — Current execution status

Last updated: 2026-07-13

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
- `P0-022A Image Preprocessing Workspace` — complete and verified; PR #28 CI passed.
- `P0-022B OCR Region Overlay and Sync` — complete and verified; PR #29 CI passed.
- `P0-022C Full Visual Backup and Restore` — complete and verified; PR #30 CI passed.
- `P0-023 Add Quizlet-style cards and golden generated quizzes` — complete and verified.
- `P1-001 Add multi-page image materials` — complete and verified; PR #31 CI passed.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Multi-page image materials

- Added a separate intake choice for keeping photographs as individual materials or combining them into one ordered image material.
- Added durable page metadata with stable page ids, file fingerprints, status, language, ordering and reload-safe IndexedDB sources.
- Added page add, replace, confirmed delete, drag-and-drop reorder and keyboard-friendly up/down reorder controls.
- Added independent image preprocessing, source selection, OCR/HTR draft, region overlay and manual correction for every page.
- Added OCR for one page and sequential OCR for all unfinished pages with cancellation and independent failure states.
- Preserved partial success: one failed image does not remove successful pages or their reviewed drafts.
- Added explicit application of one page or all reviewed pages; unreviewed OCR is never promoted to searchable source text.
- Added stable page-aware material chunks with page number and visual page identity encoded in the source section.
- Reindex page numbers after page reorder or deletion without losing stable source identity.
- Added page-level duplicate detection for the current batch and previously stored multi-page materials.
- Updated lifecycle pruning so parent materials and page-level visual ids remain valid while orphaned IndexedDB records are still removed.
- Extended full ZIP export, validation, merge blocking and restore to original page images, page OCR drafts, preprocessing recipes and processed previews.
- Added cancellable OCR requests and a permanent `verify:multipage-image-contract` gate to local checks and CI.

### Two-sided flashcards

- Replaced the default flashcard route with a real front/back study deck instead of permanently visible text fields.
- Added a large two-sided card with a 3D flip, tap/click and Space-key interaction.
- Added Previous, Next, Shuffle, Again and Know controls plus deck progress and completion states.
- Kept course and topic filtering in the study experience.
- Kept the existing spaced-repetition state through `store.reviewCard`.
- Preserved bulk editing, CSV, source relinking and duplicate cleanup under a secondary Manage deck screen.

### Golden generated quiz

- Used the supplied archaeology trainer as the behavioral reference for the generation and practice contract.
- Added a dedicated `golden-quiz-v1` source-grounded generation pipeline.
- Required exactly four options, one correct answer, plausible same-category distractors, a rationale for every option, a correct-answer explanation and a memory hint.
- Added Hebrew-first output with optional Russian prompt and option translations when the source and interface languages differ.
- Kept source ID validation, rejected-ID reporting, uncited-item counts and no-guessing behavior.
- Stored rich feedback as readable versioned Markdown inside the existing explanation field, avoiding a destructive local-data migration.
- Added a trainer that shuffles questions and options without losing correctness, translations or rationales.
- Added locked answer feedback, green correct state, red selected-wrong state, per-option rationales, memory hints and translation toggle.
- Final scores are saved as quiz attempts.
- Preserved the existing advanced question editor under a secondary Question editor screen.
- Added permanent flashcard and golden-quiz product contracts to documentation and CI verification.

### Image preprocessing and OCR review

- Added a non-destructive photo workspace with 90° and fine rotation, crop, automatic/manual deskew, grayscale, brightness, contrast, threshold and optional sharpening.
- Kept the original source blob immutable and stored the versioned recipe and one derived preview in separate IndexedDB stores.
- Made original/processed OCR source selection explicit, reload-safe and fail-safe.
- Added synchronized region selection, hover, zoom, pan, drawing, movement and resizing over the exact source raster used by OCR.
- Refuse to display stale coordinates over a mismatched crop, rotation or processed preview.

### Full visual backup and restore

- Added a versioned ZIP workflow for text data, original photos, OCR drafts, preprocessing recipes and valid processed previews.
- Every declared payload is validated by size, SHA-256 checksum, ZIP CRC, format version and visual-source mapping before current browser data can change.
- The Data page distinguishes lightweight JSON from full ZIP and provides verified preview, warning/conflict list, safe merge and replace-everything.
- Visual IndexedDB stores and text storage roll back together if application fails.
- Multi-page child images and drafts now participate in the same backup and conflict rules as top-level image materials.

## Verification state

- Documentation verification passed.
- Selected-source AI contract verification passed.
- Syllabus review and confirmation contract verification passed.
- Course Workspace v1 contract verification passed.
- Reliable Notes editor contract verification passed.
- Quizlet-style two-sided flashcard and management contract verification passed.
- Golden bilingual quiz generation, trainer and advanced editor contract verification passed.
- Detail-route reachability contract verification passed.
- Core UI honesty and actionability contract verification passed.
- Evaluation fixture coverage verification passed.
- Durable image intake, OCR review, lifecycle cleanup and backup-honesty contract verification passed.
- Image preprocessing, selected-source OCR and Worker-backed large-image processing contract verification passed.
- OCR region-overlay synchronization, normalized coordinates and safe visual-source binding contract verification passed.
- Full visual backup, integrity validation, page-level source coverage, previewed conflict handling and rollback contract verification passed.
- Multi-page image intake, page-aware OCR/preprocessing, partial retry, cancellation, explicit apply and backup contract verification passed.
- Deterministic syllabus, grounding, multilingual and OCR evaluation suites passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.

## Next execution target

1. P1: add golden-quiz quality evaluation with category scores, negative controls and saved review candidates.
2. P1: add critical browser end-to-end tests for material, photo/OCR, flashcard, quiz and full-backup flows.
3. Run the connected multimodal provider against a private real-photo pack: printed Hebrew, Hebrew handwriting, mixed RTL/LTR and photographed mathematics.
4. Run the live golden quiz generator on one complete Hebrew course source pack and inspect distractor and rationale quality manually.
5. Build local-first global search v2 after the critical flow tests are stable.

## Blockers

- Code, contracts, deterministic evaluations, typecheck, lint and production build pass.
- Live OCR quality still requires private real-photo validation.
- Golden quiz generation is structurally enforced and build-verified, but model output quality still requires a live run against a real Hebrew source pack.
- A local browser-level interaction pass still needs to be repeated on a workstation browser; this execution environment cannot install Chromium from the Playwright CDN.
