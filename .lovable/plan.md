
# Task 1 — Real Course create & open from the Study Room

Scope-locked per your instructions. No dashboard/materials/notes/calendar/study-session changes. No CSS edits (the `.empty-book-slot` class already exists in `src/styles.css`). No AI / ingestion / store-schema changes.

## Files

**Modified**
- `src/routes/app.courses.tsx` — remove `samples` fallback + hardcoded progress array; render real `data.courses`; wire "New course" button and `EmptyBookSlot` to a shared create dialog; deterministic tone; empty-state shelf.
- `src/components/study-room-ui.tsx` — one minimal, backwards-compatible change: make `CourseBook`'s `progress` prop accept `number | null`; when `null` render an em-dash and an empty bar (no filled width). All existing callers pass numbers → visually unchanged.
- `src/lib/i18n.ts` — add 3 keys in RU + EN (see below). No renames, no removals.

**New**
- `src/lib/course-tone.ts` — pure helper `courseTone(id: string): BookTone` (djb-style hash → one of the 7 existing tones).
- `src/components/lamdan/empty-book-slot.tsx` — thin wrapper around the existing `.empty-book-slot` class, rendered as a real `<button>` with `onClick` and a localized label.

## i18n keys added (RU default preserved)

| key | RU | EN |
|---|---|---|
| `emptyShelfTitle` | Полка пока пуста | Your shelf is empty |
| `emptyShelfHint` | Добавьте первый курс, чтобы начать | Add your first course to begin |
| `addFirstCourse` | Добавить первый курс | Add your first course |

Dialog reuses existing `t.createCourse`, `t.title`, `t.courseNumber`, `t.semester`, `t.credits`, `t.instructor`, `t.save`, `t.cancel`.

## Behavior

1. `/app/courses` renders only real `data.courses`. `samples` array and the `[72,54,81,…]` progress array are deleted.
2. With zero courses: one `WoodenShelf` containing a centered `EmptyInk` block (`emptyShelfTitle` + `emptyShelfHint`) followed by a single `EmptyBookSlot` labeled `addFirstCourse`. No other shelf is rendered.
3. With ≥1 courses: books fill shelves 4-per-row (existing layout); the trailing `EmptyBookSlot` on the last shelf opens the same dialog as the header brass "New course" button.
4. Dialog (shadcn `Dialog`, consistent with rest of app): required `title`, optional `number`, `semester`, `credits` (numeric), `instructor`. Save disabled until `title.trim()` is non-empty. On save → `store.createCourse({ title, number?, semester?, credits?, instructor?, status: "not_started" })`, close dialog.
5. After save the new `CourseBook` appears immediately (reactive `useData`), persists via existing localStorage, and clicking it navigates to `/app/courses/$courseId`.
6. Each book's spine tone comes from `courseTone(course.id)` → stable across reloads.
7. Progress: passed as `null` to `CourseBook`. Percent slot renders `—`; progress bar stays empty. No fake percentages anywhere. Header subtitle switches from "N books currently on the shelf" to a real count using existing pluralization pattern already used elsewhere (plain interpolation, no new keys).
8. `CourseBook` remains a navigation component; the empty slot is a separate `EmptyBookSlot` component with its own `onClick`.

## Untouched

- `src/styles.css` (relies on existing `.empty-book-slot`, `.course-library__row`, `.wooden-shelf`, `.empty-ink`, `.room-heading`, `.brass-button`, `.course-book*`).
- `src/routes/app.dashboard.tsx`, `app.materials.tsx`, `app.calendar.tsx`, `app.notes.tsx`, `app.study-session.tsx`, `app.courses.$courseId.tsx` — no edits.
- `src/lib/store.ts` schema.
- All AI routes and components.
- Deletion: not implemented in this task (no existing delete affordance on this page — leaving that for a later task).

## Acceptance verification I will run before reporting

- `bun run build` (or the harness's build/typecheck) passes.
- Manual: reload `/app/courses` empty → sees empty state, no `SOC101/GOV202/HEB110`, no `72%`. Create a course via header button → book appears. Create via `EmptyBookSlot` → same dialog. Reload → course + tone preserved. Click book → `/app/courses/$id` opens the existing detail page unchanged.
- Spot-check `/app/dashboard`, `/app/materials`, `/app/calendar`, `/app/notes`, `/app/study-session` render identically.

## Deferred to later tasks (unchanged from earlier audit)

- Dashboard "Continue studying" fallback + Today panel.
- Materials fallback rows + folder counts + Upload wiring.
- Calendar real week + events.
- Notes real editor.
- Study session recording.
- Course progress calculator (feeds real numbers back into `CourseBook`).
- Reskin of course detail / flashcards / quizzes / assignments.

Approve to switch to build mode and I'll implement exactly this.
