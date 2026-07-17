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
- `P1-014A Frozen Exam Engine` — complete and verified.
- `P1-014B Bounded exam planning` — complete and verified.

## Lecture-media capability

The merged lecture path now supports:

- local complete audio/video storage in sequential IndexedDB chunks;
- quota checks, cancellation, replacement staging and SHA-256 verification;
- reviewed SRT/VTT/TXT transcript drafts;
- explicit provider consent and bounded provider-ready requests;
- cancellation, retry and stale-source rejection;
- resumable overlapping range queues;
- local range extraction with manual fallback;
- draft-only merge with visible gaps;
- streaming `.lamdan-lecture` export;
- verified duplicate restore with full rollback;
- offline Hebrew/Russian WER/CER, timestamp, speaker, uncertainty, latency and cost evaluation.

No provider candidate becomes trusted text or a source chunk automatically.

## Exam capability

The merged Exam Engine now supports:

- source-linked frozen multiple-choice sessions;
- immutable prompts, options, answers and source ids after start;
- deadline and partial-answer persistence;
- per-question evidence only for actual answers;
- raw submitted score without an unsupported grade forecast;
- a separate exam-planning profile with date, weekdays, daily/session limits and topic weights;
- deterministic weighted allocation over at most the final 180 days;
- planning persistence that does not rewrite frozen sessions;
- original frozen-exam and combined planning → exam → reload Chromium proofs.

## Verification state

The final heads for PRs #54, #57 and #58 passed:

- permanent contracts and deterministic evaluations;
- TypeScript and ESLint;
- production builds;
- dedicated Chromium proofs;
- complete 111-step repository CI;
- long-media, automatic transcription, resumable transcription, extraction, backup, restore and Exam Engine regressions.

Intermittent hosted-runner/CDP failures were rerun only after static gates and diagnostic evidence showed no product regression. Permanent planning-browser diagnostics now upload on future failures.

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
