# Lamdan — Current execution status

Last updated: 2026-07-17

## Current milestone

**Milestone H — Academic Autopilot foundation**

Lamdan remains a late MVP / early closed alpha. The trusted local-first source → review → output → practice loop is implemented. M1 is not declared because the live OCR, Hebrew golden-quiz and one-course pilot gates still require external inputs.

## Recently merged

- `P1-010C4 Staged streaming lecture restore` — PR #54, merge `5a15cdee92313f4e6a0828a55d0011e192fce3bc`.
- `P1-010C5 Offline Hebrew/Russian lecture-quality evaluator` — PR #57, merge `6bf6db4fbd8f3de1b0bf5ef66f9e003d874f4510`.
- `P1-014B Bounded exam planning` — PR #58, merge `c9b1a06d0bd7ddefda90da1d4abb872617e39a05`.

The old stacked PRs #55 and #56 were closed as superseded after clean PRs #57 and #58 merged.

## Completed task state

- `P0-001` through `P0-023` — complete and verified.
- `P1-001` through `P1-005` — complete and verified.
- `P1-010A` through `P1-010C4` — complete and verified.
- `P1-010C5 evaluator infrastructure` — complete and verified; live evidence remains externally blocked.
- `P1-011 Study Command Center` — complete and verified.
- `P1-012 Lecture-to-Study-Pack` — complete and verified.
- `P1-013A` through `P1-013E` — complete and verified.
- `Workspace backup v2` — complete and verified in PR #41.
- `P1-014A Frozen Exam Engine` — complete and verified.
- `P1-014B Bounded exam planning` — complete and verified.

## Lecture-media capability

The merged lecture path now supports local complete media storage, reviewed transcript drafts, explicit provider consent, resumable ranges, local extraction, streaming export, verified duplicate restore and offline Hebrew/Russian quality evaluation.

No provider candidate becomes trusted text or a source chunk automatically.

## Exam capability

The merged Exam Engine now supports frozen source-linked sessions, immutable questions after start, deadline and partial-answer persistence, per-question evidence for actual answers, raw submitted scores and a separate bounded exam-planning profile.

## Verification state

The final heads for PRs #54, #57 and #58 passed permanent contracts, deterministic evaluations, TypeScript, ESLint, production builds, dedicated Chromium proofs, complete repository CI and all lecture/transcription/Exam Engine regressions.

The critical browser end-to-end target remains mandatory for material, OCR, flashcard, quiz and full-backup flows. Intermittent hosted-runner/CDP failures are rerun only after static gates and diagnostics show no product regression.

## Existing external blockers

### P1-006

Requires four legally usable representative images and a reachable configured deployment for live OCR quality measurement.

### P1-007

Requires one complete legally usable Hebrew course source pack and manual question review.

### P1-008

Depends on P1-006 and P1-007. M1 remains unachieved until the complete pilot script passes.

### Live lecture quality

The evaluator is merged, but real quality, latency and cost results require legally usable Hebrew/Russian recordings, exact human reference transcripts and reviewed provider candidates.

## Active target

`P1-009 Deep multi-page browser coverage`:

1. page reorder with stable citations;
2. one failed OCR page with successful siblings preserved;
3. page replacement and source-link repair;
4. page-level visual export/restore;
5. dangling-reference assertions after every flow and reload.

After P1-009, the next planned product slice is `P1-015 Assignment Copilot`.
