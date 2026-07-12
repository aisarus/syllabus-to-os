# Lamdan — Current execution status

Last updated: 2026-07-12

## Current milestone

**Milestone B — Reliable universal intake**

## Task status

- `P0-001 Add continuous integration` — implemented.
- `P0-002 Audit and normalize all active routes` — implemented for the current shell; route inventory is documented in `docs/ROUTE_AUDIT.md`.
- `P0-003 Remove tracking-first product flows` — implemented in the primary shell and core course workspace. Deferred route data remains intact.
- `P0-004 Create one shared intake service` — implemented; Dashboard and Materials now use `src/lib/material-intake.ts`.
- `P0-005 Build multi-file upload queue` — next after CI is green.

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
- Pull-request CI confirmed documentation verification and TypeScript pass.
- The first validation run failed at ESLint; the production build was skipped by the original workflow.
- CI now continues through build and uploads `lint-output.txt`, `build-output.txt` and a generated `prettier-fix.patch` as the `ci-diagnostics` artifact when a quality gate fails.
- A new pull-request run is pending. Do not claim a clean build until it succeeds.

## Next execution target

1. Download the diagnostics artifact from the next pull-request run if lint or build fails.
2. Apply the exact formatting or code fixes and rerun CI.
3. Start `P0-005` with a session-level multi-file queue and controlled concurrency only after the current baseline is green.

## Blockers

None. The remaining validation work is mechanical and driven by CI output.
