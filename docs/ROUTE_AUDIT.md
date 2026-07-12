# Lamdan route audit

Last reviewed: 2026-07-12

This inventory defines which `/app` routes belong to the current content-first product and which routes are preserved only for compatibility. It is intentionally separate from the router so no stored data or direct URL is deleted while the product shell stays focused.

## Classification rules

- **core** — part of the primary course → material → output workflow and eligible for primary navigation.
- **system** — supports the core workflow but is not study content itself.
- **deferred** — working route preserved by direct URL, but excluded from primary navigation until it directly supports the content workflow.
- **legacy-hidden** — historical route retained for compatibility; no new product work should depend on it.

## Core routes

| Route | Role | Audit note |
| --- | --- | --- |
| `/app/dashboard` | Universal intake and recent content | Uses real store data and honest empty states. |
| `/app/courses` | Course library | Course creation/editing is responsive and localized. |
| `/app/courses/$courseId` | Course content workspace | Topics and linked content are primary; progress bars, deadlines and timer-style tracking are removed. |
| `/app/materials` | Material library and intake | Active now; its duplicate upload paths will be unified by P0-004. |
| `/app/materials/$materialId` | Material detail | Active now; scheduled for replacement by the Material Workspace in P0-008. |
| `/app/notes` | Notes workspace | Responsive RU/EN shell and real store data. |
| `/app/flashcards` | Flashcard library and review | Review remains a content action, not a dashboard metric. |
| `/app/quizzes` | Quiz library | Uses real quizzes and attempts only. |
| `/app/quizzes/$quizId` | Quiz editor/practice | Active detail route. |

## System routes

| Route | Role | Audit note |
| --- | --- | --- |
| `/app/` | Redirect | Redirects to the dashboard. |
| `/app/import-syllabus` | Syllabus intake | Core-supporting system flow; full review/confirmation upgrade is planned. |
| `/app/search` | Global retrieval | RU/EN scope labels normalized. |
| `/app/data` | Import/export and reset | Sample-data loader removed from the active UI. |
| `/app/settings` | Language, appearance and AI diagnostics | Kept in system navigation. |

## Deferred routes

These routes may remain reachable by direct URL, but must not appear in primary navigation or compete with the content workflow:

| Route | Reason for deferral |
| --- | --- |
| `/app/assignments` | Useful domain data, but assignment tracking is not part of the current core loop. |
| `/app/calendar` | Calendar data is preserved; scheduling is not a core identity. |
| `/app/study-plan` | Planning UI is deferred until it can be generated from real course content. |
| `/app/progress` | Generic progress analytics are explicitly deferred. |
| `/app/study-session` | Timer/ambient-room workflow is outside the current product identity. |
| `/app/presentations` | Presentation generation is secondary to notes, cards and quizzes. |
| `/app/presentations/$outlineId` | Detail route retained for existing outlines. |

## Legacy-hidden routes

| Route | Reason |
| --- | --- |
| `/app/program` | Historical top-level program editor; syllabus-to-course flow replaces it as the primary entry point. |

## Product-shell requirements

1. Primary navigation contains only Dashboard, Courses, Materials, Notes, Flashcards and Quizzes.
2. System navigation contains Import Syllabus, Search, Data and Settings.
3. Deferred and legacy-hidden routes are never promoted automatically.
4. No core route may introduce fake courses, fake schedule entries, streaks, study-hour charts or timer prompts.
5. Existing calendar, assignment, session and presentation data must not be deleted by route cleanup.
6. Any route promoted from deferred to core requires an explicit roadmap decision and a content-workflow justification.
