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
- `P0-023 Add Quizlet-style cards and golden generated quizzes` — complete and verified.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

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

### Visual-source lifecycle and backup honesty

- Added IndexedDB storage statistics for original images and OCR drafts.
- Added explicit full-clear and orphan-pruning operations for browser-local visual data.
- Added an application-level lifecycle janitor that removes image and OCR records after their material is deleted, reset or replaced by imported data.
- Made JSON backup limitations explicit and made destructive reset cover both localStorage and IndexedDB.

### Image preprocessing before OCR

- Added a non-destructive photo workspace with 90° and fine rotation, crop, automatic/manual deskew, grayscale, brightness, contrast, threshold and optional sharpening.
- Kept the original source blob immutable and stored the versioned recipe and one derived preview in separate IndexedDB stores.
- Made original/processed OCR source selection explicit, reload-safe and fail-safe: a missing or stale preview falls back to the original instead of silently changing OCR input.
- Put image decode, deskew and pixel work into an OffscreenCanvas Web Worker where available; the bounded fallback keeps older browsers usable and reports canvas/decode errors visibly.
- Added a permanent `verify:image-preprocessing-contract` quality gate to local checks and CI.

### OCR region overlay and review sync

- Bound every newly created OCR draft to the exact original or processed raster used for recognition, including the derived recipe key where applicable.
- Added a responsive region overlay with synchronized text/image selection and hover, zoom, pan, fit-to-page, keyboard movement and touch-aware interaction modes.
- Added safe manual region drawing, move/resize editing and confirmed deletion while preserving region order and the editable-draft-before-apply model.
- Refuse to display legacy or stale coordinate data over a mismatched crop, rotation or deskewed preview; a new OCR pass is required instead.
- Added a permanent `verify:ocr-region-overlay-contract` quality gate to local checks and CI.

## Verification state

- Documentation verification passed.
- Selected-source AI contract verification passed.
- Syllabus review and confirmation contract verification passed.
- Course Workspace v1 contract verification passed.
- Reliable Notes editor contract verification passed.
- Quizlet-style two-sided flashcard and management contract verification passed.
- Golden bilingual quiz generation, trainer and advanced editor contract verification passed.
- Core UI honesty and actionability contract verification passed.
- Evaluation fixture coverage verification passed.
- Durable image intake, OCR review, lifecycle cleanup and backup-honesty contract verification passed.
- Image preprocessing, selected-source OCR and Worker-backed large-image processing contract verification passed.
- OCR region-overlay synchronization, normalized coordinates and safe visual-source binding contract verification passed.
- Deterministic syllabus, grounding, multilingual and OCR evaluation suites passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.

## Next execution target

1. P0-022C: build a versioned full visual backup and restore flow for sources, OCR drafts and text data.
2. Run the connected multimodal provider against a private real-photo pack: printed Hebrew, Hebrew handwriting, mixed RTL/LTR and photographed mathematics.
3. Run the live golden quiz generator on one complete Hebrew course source pack and inspect distractor and rationale quality manually.
4. Save golden-quiz candidates as a permanent quality evaluation set.

## Blockers

- Code, contracts, deterministic evaluations, typecheck, lint and production build pass.
- Live OCR quality still requires private real-photo validation.
- Golden quiz generation is structurally enforced and build-verified, but model output quality still requires a live run against a real Hebrew source pack.
- A local browser-level interaction pass still needs to be repeated on a workstation browser; this execution environment cannot install Chromium from the Playwright CDN.
