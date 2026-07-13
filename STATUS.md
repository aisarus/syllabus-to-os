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
- `P1-002 Add golden quiz quality evaluation` — complete and verified; PR #32 CI passed.
- `P1-003 Add critical browser end-to-end coverage` — complete and verified; PR #33 CI passed.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Critical browser end-to-end coverage

- Added a dependency-free Chromium runner that starts the production preview and drives the browser through the Chrome DevTools Protocol.
- Added isolated browser contexts for every scenario so localStorage, IndexedDB, navigation, downloads and confirmation dialogs are exercised as they are in the real app.
- Verified the Materials library opens the non-nested material detail route and renders the stored source text.
- Verified a locally stored image can receive a manual OCR draft, save it, apply it to the material, create source chunks and survive a full reload.
- Verified the default flashcard experience hides the answer, flips through the real accessible control and persists the review action.
- Verified the golden quiz trainer preserves the correct option through shuffling, shows the grounded rationale and stores a completed attempt.
- Verified a full visual ZIP can be downloaded, all local text and image data can be cleared, and the archive can restore both the material and its original IndexedDB image.
- Added bounded execution so a stuck browser process cannot hold CI indefinitely.
- Added DOM, console, Chrome, preview and screenshot diagnostics for failed browser scenarios.
- Added a permanent `verify:critical-browser-e2e-contract` gate and a real Chromium CI step.

### Golden quiz quality evaluation

- Added category-level automatic scoring instead of one opaque quality percentage.
- Added separate structure, source-support, distractor, rationale, translation, memory-hint and answer-balance scores.
- Added hard checks for exactly four unique options, a valid correct index, existing source chunk ids and source-supported numbers and dates.
- Added detection of meta-options, placeholder options, answer-length clues, weak rationales, contradiction in the correct rationale, missing translations and answer-revealing hints.
- Kept semantic-category, answer-observability and translation-polarity heuristics as visible manual-review flags rather than pretending they are deterministic failures.
- Added a quality-review route linked from every quiz.
- Added per-question manual rubrics for clarity, distractor plausibility, factual correctness, rationale quality, translation quality, difficulty and source support.
- Added approve, reject and needs-edit decisions with reviewer comments stored locally.
- Added versioned candidate export so a reviewed live result can later become a permanent regression fixture.
- Added five deterministic fixture domains: Hebrew archaeology, social science, information studies, mixed Hebrew/Russian and Israeli dates/numbers.
- Added a deliberately bad negative control for every domain and made CI fail if one of them passes.
- Added `eval:golden-quiz`, JSON reporting, permanent contract verification and reusable failure diagnostics to CI.
- Recorded fixtures validate the evaluation system; they are not presented as proof that a fresh live-model generation was manually approved.

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

### Two-sided flashcards and golden generated quiz

- The default flashcard route uses a real front/back study deck rather than permanently visible text fields.
- Previous, Next, Shuffle, Again, Know and due-review controls preserve the existing spaced-repetition state.
- Bulk editing, CSV, source relinking and duplicate cleanup remain under Manage deck.
- Golden quiz generation requires exactly four options, one correct answer, plausible distractors, a rationale for every option, a correct-answer explanation, a memory hint and source ids.
- Hebrew-first output can include Russian prompt and option translations.
- The trainer preserves correctness while shuffling questions and options and saves final attempts.

### Image preprocessing, OCR review and backup

- Added non-destructive rotation, crop, deskew, grayscale, brightness, contrast, threshold and sharpening with separate original, recipe and derived preview storage.
- Added synchronized region selection, hover, zoom, pan, drawing, movement and resizing over the exact image used by OCR.
- Added a versioned full ZIP workflow for text data, original photos, OCR drafts, preprocessing recipes and valid processed previews.
- Full ZIP integrity is checked by size, SHA-256, ZIP CRC, format version and visual-source mapping before browser data can change.
- Visual IndexedDB stores and text storage roll back together if application fails.

## Verification state

- Documentation verification passed.
- Selected-source AI contract verification passed.
- Syllabus review and confirmation contract verification passed.
- Course Workspace v1 contract verification passed.
- Reliable Notes editor contract verification passed.
- Quizlet-style two-sided flashcard and management contract verification passed.
- Golden bilingual quiz generation, trainer and advanced editor contract verification passed.
- Golden quiz category scoring, negative controls, manual review and candidate export contract verification passed.
- Golden archaeology, social science, information studies, mixed-language and dates/numbers quality fixtures passed; every negative control failed as intended.
- Detail-route reachability contract verification passed.
- Core UI honesty and actionability contract verification passed.
- Evaluation fixture coverage verification passed.
- Durable image intake, OCR review, lifecycle cleanup and backup-honesty contract verification passed.
- Image preprocessing, selected-source OCR and Worker-backed large-image processing contract verification passed.
- OCR region-overlay synchronization, normalized coordinates and safe visual-source binding contract verification passed.
- Full visual backup, integrity validation, page-level source coverage, previewed conflict handling and rollback contract verification passed.
- Multi-page image intake, page-aware OCR/preprocessing, partial retry, cancellation, explicit apply and backup contract verification passed.
- Critical material, manual OCR, flashcard, golden quiz and full visual backup flows passed in real headless Chromium.
- Deterministic syllabus, grounding, multilingual and OCR evaluation suites passed.
- TypeScript passed.
- ESLint passed.
- Production build passed.

## Next execution target

1. Run the connected multimodal provider against a private real-photo pack: printed Hebrew, Hebrew handwriting, mixed RTL/LTR and photographed mathematics.
2. Run the live golden quiz generator on one complete Hebrew source pack, review it in the quality screen and promote an approved candidate to permanent fixtures.
3. Build local-first global search v2 now that the critical browser flows are stable.
4. Add audio transcription using the same source-draft-review-apply contract.
5. Add deeper multi-page browser coverage for page reorder, partial OCR failure and page-level ZIP restore.

## Blockers

- Code, contracts, deterministic evaluations, typecheck, lint, production build and critical Chromium E2E pass.
- Live OCR quality still requires a private real-photo validation pack.
- Golden quiz generation is structurally enforced and deterministically evaluated, but live model quality still requires a reviewed generation from a real Hebrew source pack.
