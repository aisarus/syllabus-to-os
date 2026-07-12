# Lamdan Design System — Academic Content Workspace

## Product direction

Lamdan is a content-processing workspace for Israeli university students. Its core is:

1. import a syllabus or study material;
2. extract and organize its content;
3. create notes, flashcards and quizzes with AI;
4. keep every output linked to its source and course.

Lamdan is not a habit tracker, timer dashboard, gamified learning app or analytics product.

## Permanent visual foundation

The canonical direction is **Academic Content Workspace**:

- editorial dark interface;
- charcoal-green background;
- warm cream typography;
- one restrained brass accent;
- serif display headings;
- compact, readable content grids;
- no illustrated rooms or full-page scene assets;
- no 3D books, furniture, ivy, lamps or decorative physical simulations;
- no fixed-size canvas;
- no background images for application structure;
- no absolute positioning for primary layout.

## Product metaphors

Physical metaphors may be used only as small icons or subtle component details:

- course: a structured record, not a 3D book;
- material: a file or document row;
- note: an editable document;
- flashcard: a compact study item;
- quiz: a question set.

The interface must remain a responsive application, not an illustration.

## Core navigation

Primary:

- Dashboard
- Courses
- Materials
- Notes
- Flashcards
- Quizzes

System:

- Import syllabus
- Search
- Import / Export
- Settings

Assignments, Calendar, Study Plan, Progress, Study Session and Presentations may continue to exist as routes, but they are not part of the primary product shell until they support the content workflow clearly.

## Design tokens

Canonical tokens live in `src/content-workspace.css`.

- background: `#0d100e`
- panel: `#151916`
- raised panel: `#1a1f1b`
- cream text: `#eee2c8`
- muted text: `#9e9889`
- brass accent: `#c7924f`
- borders: low-opacity brass

Typography:

- headings: Fraunces
- UI text: Source Sans 3 / system sans
- metadata: JetBrains Mono

## Layout rules

- Use CSS Grid and Flexbox.
- Main content max width: about 1240 px.
- Radius: 5–8 px.
- Shadows are minimal and never used to fake 3D objects.
- Sections are separated by spacing and thin borders.
- Mobile uses a normal stacked layout and drawer navigation.
- Never scale the whole application using `transform: scale()`.

## Content rules

Dashboard prioritizes:

- universal material intake;
- syllabus import;
- AI generation of notes, flashcards and quizzes;
- recent materials;
- real courses;
- content-library counts.

Do not show fake progress, fake schedules, fake courses, streaks, timers, study hours or weak-topic analytics.

## AI rules

- AI outputs open as drafts.
- User confirms before saving.
- Sources remain attached through material and chunk IDs.
- User-created and imported content is never silently translated or overwritten.
- RU/EN is application chrome; Hebrew, Arabic and mixed language content stays intact.

## Guardrails for future agents

- Do not reintroduce the immersive Study Room scene.
- Do not use generated dashboard screenshots as backgrounds.
- Do not add tracking widgets unless explicitly requested.
- Do not add generic SaaS gradients, glassmorphism or neon colors.
- Do not add a new color outside the token system without documenting it.
- Do not hardcode user-visible English strings when a dictionary key exists.
- Preserve store schemas, source links and localStorage compatibility.
