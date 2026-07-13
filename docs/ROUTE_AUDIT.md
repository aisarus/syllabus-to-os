# Lamdan route audit

Last reviewed: 2026-07-12

This inventory defines which `/app` routes belong to the current content-first product and which routes are preserved only for compatibility. It is intentionally separate from the router so no stored data or direct URL is deleted while the product shell stays focused.

## Classification rules

- **core** — part of the primary course → material → output workflow and eligible for primary navigation.
- **system** — supports the core workflow but is not study content itself.
- **deferred** — working route preserved by direct URL, but excluded from primary navigation until it directly supports the content workflow.
- **legacy-hidden** — historical route retained for compatibility; no new product work should depend on it.

## Core routes

| Route                        | Role                                | Release-readiness result                                                                                                                             |
| ---------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/dashboard`             | Universal intake and recent content | Real store data only; file intake, syllabus intake and AI draft actions are functional; localized empty and fallback copy.                           |
| `/app/courses`               | Course library                      | Content-first library with no visible completion status, no silent program assignment, actionable empty states and safe content-preserving deletion. |
| `/app/courses/$courseId`     | Course content workspace            | Real metadata, syllabus topics, linked materials and outputs; explicit source scope for AI; no progress bars, deadlines or timer identity.           |
| `/app/materials`             | Material library and intake         | Real shared file/text intake, filters, processing state, source metadata and working deletion.                                                       |
| `/app/materials/$materialId` | Material workspace                  | Editable source chunks, selected-source AI actions, output history and trust diagnostics.                                                            |
| `/app/notes`                 | Notes library                       | Real search/filter, duplication and merge preview backed by persistent notes.                                                                        |
| `/app/notes/$noteId`         | Note editor                         | Visible autosave state, Markdown editing, source comparison and selected-text conversion.                                                            |
| `/app/flashcards`            | Flashcard Studio                    | Inline editing, bulk curation, duplicate review, CSV import/export and secondary review mode.                                                        |
| `/app/quizzes`               | Quiz library                        | Real quiz/question/attempt counts, validation state and working creation/deletion.                                                                   |
| `/app/quizzes/$quizId`       | Quiz Studio                         | Full question editing, validation, ordering, source links, practice/exam modes and duplicate review.                                                 |

## System routes

| Route                  | Role                                    | Release-readiness result                                                                                                   |
| ---------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/app/`                | Redirect                                | Redirects to the dashboard.                                                                                                |
| `/app/import-syllabus` | Syllabus intake                         | Universal extraction, editable review, duplicate-safe confirmation and no silent course mutation.                          |
| `/app/search`          | Global retrieval                        | Real store search; course, material, chunk, note, quiz and question hits open their exact content target where one exists. |
| `/app/data`            | Backup, restore and reset               | Export works; import and reset are explicitly destructive and require confirmation; disabled states explain missing data.  |
| `/app/settings`        | Language, appearance and AI diagnostics | Explicit loading/ready/error diagnostics, retry control and localized browser-storage disclosure.                          |

## Deferred routes

These routes may remain reachable by direct URL, but must not appear in primary navigation or compete with the content workflow:

| Route                           | Reason for deferral                                                               |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `/app/assignments`              | Useful domain data, but assignment tracking is not part of the current core loop. |
| `/app/calendar`                 | Calendar data is preserved; scheduling is not a core identity.                    |
| `/app/study-plan`               | Planning UI is deferred until it can be generated from real course content.       |
| `/app/progress`                 | Generic progress analytics are explicitly deferred.                               |
| `/app/study-session`            | Timer/ambient-room workflow is outside the current product identity.              |
| `/app/presentations`            | Presentation generation is secondary to notes, cards and quizzes.                 |
| `/app/presentations/$outlineId` | Detail route retained for existing outlines.                                      |

## Legacy-hidden routes

| Route          | Reason                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `/app/program` | Historical top-level program editor; syllabus-to-course flow replaces it as the primary entry point. |

## Verified product-shell requirements

1. Primary navigation contains only Dashboard, Courses, Materials, Notes, Flashcards and Quizzes.
2. System navigation contains Import Syllabus, Search, Data and Settings.
3. Deferred and legacy-hidden routes are not promoted automatically.
4. No core route introduces fake courses, schedules, streaks, study-hour charts or timer prompts.
5. Visible counters are derived from the real local store.
6. Core destructive actions require confirmation and preserve linked content where the user-facing copy promises preservation.
7. Empty and no-result states provide a working next action or point to a visible working action in the same page header.
8. AI connectivity is never inferred while status is still loading.
9. RU and EN application chrome do not rely on a hardcoded English fallback.
10. Existing calendar, assignment, session and presentation data remain stored and reachable by compatibility routes.
11. Any route promoted from deferred to core requires an explicit roadmap decision and a content-workflow justification.
