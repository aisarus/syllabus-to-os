# Lamdan — Current execution status

Last updated: 2026-07-12

## Current milestone

**Milestone B — Reliable universal intake**

## Task status

- `P0-001 Add continuous integration` — implemented.
- `P0-002 Audit and normalize all active routes` — implemented for the current shell; route inventory is documented in `docs/ROUTE_AUDIT.md`.
- `P0-003 Remove tracking-first product flows` — implemented in the primary shell and core course workspace. Deferred route data remains intact.
- `P0-004 Create one shared intake service` — implemented; Dashboard and Materials now use `src/lib/material-intake.ts`.
- `P0-005 Build multi-file upload queue` — next.

`STATUS.md` is the operational progress source when the detailed checkbox in `TASKS.md` has not yet been safely rewritten.

## Completed in the latest execution pass

### Stable product foundation

- Classified all `/app` routes as core, system, deferred or legacy-hidden.
- Normalized Courses list and course detail layouts for desktop and mobile.
- Removed the topic progress bar, upcoming events and assignment tracking from the core course workspace without deleting stored data.
- Kept only Materials, Notes, Flashcards and Quizzes as course-content destinations.
- Preserved direct URLs for deferred routes.

### Shared material intake

- Added `src/lib/material-intake.ts`.
- Centralized filename/content material-type inference.
- Centralized title and tag normalization.
- Centralized persistence of extraction metadata and chunks.
- Added structured outcomes: success, partial, unsupported and error.
- Routed Dashboard file uploads through the shared service.
- Routed Materials file uploads and pasted text through the same service.
- Kept failed and unsupported sources honest by storing their real processing status instead of marking them ready.
- Improved Materials filters, dialogs and narrow-screen layout while removing hardcoded fallback copy from the visible UI.

## Verification state

- Store schema and localStorage compatibility are unchanged.
- No calendar, assignment, study-session, presentation or user-content data was deleted.
- A pull request from `agent/validate-p0-foundation` is used to trigger the repository CI against the latest main baseline plus this status update.
- Do not claim a clean build until that pull-request workflow finishes successfully.

## Next execution target

1. Read the pull-request CI result and fix any concrete TypeScript, lint, documentation or build failure.
2. Start `P0-005` with a session-level multi-file queue and controlled concurrency.
3. Keep duplicate detection (`P0-006`) separate from queue delivery.

## Blockers

None unless CI reports a concrete failure.
