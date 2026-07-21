# Lamdan — Current execution status

<!-- LAMDAN_EXECUTION_LEDGER
baseline_sha: ed11ca59c0c9a0ab8029822e5d283656536e4442
baseline_pr: 85
active_phase: production-phase-0-stabilization
active_task: S4-001
active_pr: none
external_blockers: live-ocr,golden-quiz,licensed-lecture-evaluation
-->

Last updated: 2026-07-21

## Current milestone

**Production readiness Phase 0 — accessible student workflow and executable pilot**

The verified runtime baseline is `main` through commit `ed11ca59c0c9a0ab8029822e5d283656536e4442` / PR #85.

**Active task:** `S4-001 accessibility baseline and executable one-course pilot harness`  
**Active PR:** none

Lamdan now has durable-before-publish workspace persistence, an explicit repository boundary, shared AI validation, bounded execution, idempotency and end-to-end provider cancellation. The next slice must make the existing study workflow reliably operable by keyboard and turn the current pilot checklist into reproducible evidence rather than adding another product feature.

## Completed stabilization slices

- `S1-001` durable-before-publish workspace persistence — PR #75.
- `S2-001` explicit `WorkspaceRepository` and import-order independence — PR #76.
- `S3-001` shared AI validation and redacted error contracts — PR #78.
- `S3-002` request IDs, resource controls and bounded idempotency — PRs #80–#81.
- `S3-003` provider cancellation and late-result rejection — PRs #83 and #85.
- `P1-004 Add local-first global search v2` — implemented and verified in PR #34 with ranked multilingual browser-local search, URL-backed scope/course filters, contextual highlighting and deterministic Hebrew/ranking/filter evaluations.
- Workspace backup v2 — implemented in PR #41 with checksum-verified full-workspace archives, preview, merge/replace semantics, deterministic evaluations and Chromium tamper/rollback coverage; PR #109 only restored the static documentation contract.
- `S4-001` AppShell Accessibility E2E — real Chromium verifies the skip link, mobile drawer initial focus, Tab and Shift+Tab wrapping, Escape dismissal and focus restoration through a bounded targeted workflow.

## Current product state

Lamdan remains a late MVP / early closed alpha with source-linked materials, reviewed OCR and transcription drafts, Study Pack, Quiz Studio, Exam Engine, long-media backup/restore and explicit Apply/Save trust boundaries.

## External milestone blockers

- `P1-005` reviewed OCR pipeline is implemented; live quality remains gated by `P1-006`.
- `P1-006` live OCR validation requires private/licensed Hebrew and mixed-content images plus a connected provider-enabled deployment.
- `P1-007` golden Hebrew quiz validation requires a legally usable complete source pack and human review.
- `P1-008` one-course closed pilot depends on P1-006 and P1-007.
- Licensed Hebrew/Russian lecture evaluation still requires real provider credentials, reviewed references, latency and cost evidence.

## Documentation authority

`TASKS.md` is the canonical executable ledger, `PLANS.md` records the active sequence, and this file records evidence and blockers. Their shared metadata is checked by `npm run verify:docs`.

## Next execution targets

**Active task:** `S4-001 accessibility baseline and executable one-course pilot harness`

1. Audit the core shell and study loop for keyboard reachability, visible focus, focus restoration and Escape behavior.
2. Fix mixed Hebrew/Russian/English directionality and minimum contrast/text-size blockers in core paths.
3. Add deterministic accessibility contracts for the shell, dialogs and primary study surfaces.
4. Convert `PILOT.md` into a reproducible harness with setup, fixtures, expected results and evidence locations.
5. Keep live OCR, golden quiz and licensed lecture quality explicitly blocked rather than replacing them with demo claims.
6. Begin versioned schemas and IndexedDB only after the stabilization acceptance gates are green.
