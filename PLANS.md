# Lamdan implementation plans

`ROADMAP.md` defines product intent. `TASKS.md` is the canonical task ledger. `STATUS.md` records evidence and blockers. This file contains only the active delivery plan.

## Current milestone

**Milestone H — Academic Autopilot foundation**

Verified and merged:

- whole-lecture local intake and reviewed transcription — PRs #46–#47;
- resumable range transcription and local extraction — PRs #48 and #52;
- streaming lecture export and staged duplicate restore — PRs #53–#54;
- offline Hebrew/Russian lecture-quality evaluator — PR #57;
- Study Command Center and Study Pack — PRs #36–#37;
- concept/evidence sequence — PRs #38–#44;
- Workspace backup v2 — PR #41;
- frozen Exam Engine and bounded exam planning — PRs #45 and #58.

The validation infrastructure is ready; the remaining real-world runs depend on representative external inputs.

## Active delivery — P1-009 deep multi-page browser coverage

### Goal

Prove source integrity through difficult multi-page visual-material transitions that are currently covered only indirectly.

### Sequence

1. Reorder pages and prove citations still open the intended page.
2. Run a mixed OCR batch where one page fails and successful sibling pages remain usable.
3. Replace one page, re-review it and repair stale page/chunk relationships.
4. Export and restore the page-level visual bundle.
5. Assert zero dangling material, page, region and source-chunk references after every transition.
6. Reload between destructive transitions.
7. Add a permanent contract and Chromium workflow.
8. Pass complete CI plus visual backup and OCR regressions.

### Boundaries

- one failed page cannot invalidate successful siblings;
- reorder cannot move a citation to another page;
- replacement cannot leave citations pointing at removed regions or chunks;
- restore publishes nothing before checksum and relationship validation completes;
- unreadable input remains failed or review-required.

## Next

1. `P1-015 Assignment Copilot`.
2. `P1-016 Lecture Mode`.
3. `P1-017 Ask My Course`.
4. `P1-018 workload forecast`.
5. `P1-019 accessibility and explanation profile`.
6. Run the remaining validation gates when their required inputs are supplied.
