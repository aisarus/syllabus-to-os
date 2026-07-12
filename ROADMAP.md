# Lamdan — Full Product Roadmap

## 1. Product definition

Lamdan is an AI-first study-content workspace for university students in Israel.

The product accepts academic chaos — syllabi, PDFs, presentations, documents, spreadsheets, pasted text, images, links and lecture recordings — and turns it into a structured, reusable study system:

- courses and topics;
- extracted and searchable materials;
- clear notes and explanations;
- flashcards;
- quizzes and exam practice;
- source-linked knowledge that can be regenerated, merged and reused.

Lamdan is not primarily a timer, habit tracker, calendar dashboard, streak app or analytics product.

The core promise is:

> Upload a study source once. Lamdan understands it, keeps it in context and turns it into every study format you need.

## 2. Target user

### Primary user

A university or pre-academic student in Israel who studies in Hebrew or English but may think and understand better in Russian, Arabic or another language.

### Primary pains

- Course materials are spread across Moodle, WhatsApp, email, Google Drive and personal files.
- The student partially understands Hebrew academic content.
- The student does not reliably write notes during class.
- The student depends on other students' notes but does not fully understand them.
- ChatGPT can process a document, but the student must repeatedly upload context and recreate prompts.
- Notes, cards and quizzes are disconnected from the source and from each other.
- The student has no persistent course-level memory.

## 3. Product principles

1. **Content first.** Every major feature must improve ingestion, understanding, transformation or retrieval of study content.
2. **Maximum useful autonomy.** Lamdan should infer material type, language, course and useful next actions with minimal configuration.
3. **Human confirmation before persistence.** AI-generated outputs are editable drafts until the user saves them.
4. **Sources remain visible.** Notes, cards, answers and quiz questions should preserve links to material chunks and pages.
5. **Mixed-language by design.** Hebrew, Russian and English may coexist inside one course and one document.
6. **No fake intelligence.** Never invent progress, mastery, citations or source support.
7. **One stable interface.** The permanent visual foundation is Academic Content Workspace, not an illustrated room.
8. **Local-first until the core loop is excellent.** Cloud infrastructure should not slow down product validation.

## 4. Current baseline — MVP 0

The current repository already contains:

- local-first storage;
- courses and topics;
- material ingestion and text extraction for several document formats;
- material chunks;
- notes;
- flashcards;
- quizzes and quiz attempts;
- syllabus import foundations;
- server-side AI routes for notes, flashcards, quizzes and presentation outlines;
- editable AI drafts before save;
- RU/EN application localization;
- the Academic Content Workspace shell and dashboard.

The current product is a functional foundation, but not yet a complete product loop. The priority is to make one path excellent:

```text
Import course or syllabus
→ upload material
→ Lamdan understands and structures it
→ generate note, flashcards and quiz
→ review and save
→ return later and continue from the same course context
```

---

# 5. Delivery roadmap

## Phase 0 — Foundation lock

**Status:** substantially complete.

### Goal

Freeze the product identity, visual system and architectural boundaries so later work does not repeatedly redesign the product.

### Scope

- Permanent Academic Content Workspace design.
- Primary navigation limited to Courses, Materials, Notes, Flashcards and Quizzes.
- Trackers, timers, streaks and decorative analytics removed from the core shell.
- Design and agent guardrails committed to the repository.
- Existing localStorage schema preserved.

### Exit criteria

- No generated room backgrounds or fixed visual canvases.
- All new primary UI uses the shared layout and token system.
- Dashboard shows only real content or honest empty states.

---

## Phase 1 — Reliable content intake

**Priority:** P0 — next.

### Goal

Make Lamdan the easiest place to put any study material.

### User experience

The user can drag, paste or upload a source into one universal intake. Lamdan determines what it is, extracts what it can, reports limitations honestly and stores it in the library.

### Features

- Universal intake on Dashboard and Materials.
- Multi-file upload queue.
- Pasted text.
- PDF, DOCX, XLSX, CSV, TXT, Markdown, HTML, JSON, XML and YAML.
- Reliable duplicate detection.
- File type and material type classification.
- Automatic language detection: Hebrew, Russian, English, Arabic, mixed or unknown.
- Suggested course and topic association.
- Processing states: queued, extracting, ready, partial, unsupported, error.
- Clear error recovery.
- File metadata and extraction diagnostics.
- Preview of extracted text before downstream generation.

### Israeli specialization

- Hebrew and RTL-safe previews.
- Israeli course-code and syllabus heuristics.
- Recognition of common Hebrew academic headings.
- Mixed Hebrew/Russian/English text handling.

### Exit criteria

- A user can upload a real course pack without losing track of failed files.
- Every material has a visible processing status.
- Extracted text survives reload.
- Unsupported content is never reported as successfully processed.

---

## Phase 2 — Material Workspace

**Priority:** P0.

### Goal

Turn every uploaded material into an active workspace rather than a dead file entry.

### Core screen

Each material opens into a three-part workspace:

- source or page navigation;
- extracted text and selected chunks;
- actions and generated outputs.

### Features

- Material overview and metadata.
- Chunk and page navigation.
- Search inside a material.
- Select one or multiple chunks.
- Rename, tag and link to course/topic.
- Manual correction of extracted text.
- Split, merge and reorder chunks.
- Source page references where available.
- Existing outputs panel: notes, cards, quizzes and outlines created from this source.
- Quick actions: explain, summarize, translate, simplify, create note, create cards, create quiz.

### Exit criteria

- The user can identify exactly which source sections will be sent to AI.
- Every saved output preserves material and chunk relationships.
- The material page becomes the main origin point for content generation.

---

## Phase 3 — Autonomous AI transformation

**Priority:** P0.

### Goal

Make the main Lamdan promise real: one source becomes multiple high-quality study formats with minimal prompting.

### AI pipeline

1. Detect material type, source language and likely course context.
2. Suggest useful transformations.
3. Generate an editable draft.
4. Show source support and warnings.
5. Save only after confirmation.

### Note generation

- Structured lecture note.
- Short summary.
- Detailed explanation.
- Key concepts and definitions.
- Russian explanation with original Hebrew or English terms preserved.
- Compare source with an existing note and show missing content.
- Merge several sources into one note.

### Flashcard generation

- Term → definition.
- Question → answer.
- Cloze deletion.
- Hebrew ↔ Russian and Hebrew ↔ English language cards.
- Card quality cleanup.
- Duplicate detection.
- Split overloaded cards.
- Generate plausible distractor concepts where useful.

### Quiz generation

- Single-choice questions.
- Multiple-choice questions.
- True/false.
- Short answer.
- Source-based questions.
- Realistic wrong answers.
- Explanations linked to source chunks.
- Difficulty and question-count controls.

### AI trust layer

- Source citations.
- “Not found in the selected sources” state.
- Confidence and warning labels where relevant.
- Regenerate one item rather than the whole output.
- Never overwrite user content silently.

### Exit criteria

- From one material, the user can create and save a useful note, card set and quiz without writing a complex prompt.
- Outputs are editable.
- Source relationships remain intact.
- AI failures do not destroy or duplicate saved content.

---

## Phase 4 — Course Workspace and syllabus intelligence

**Priority:** P0/P1.

### Goal

Turn a syllabus into a persistent course brain.

### Syllabus import

- PDF, DOCX, XLSX, image and pasted-text syllabus intake.
- Extract course title, code, instructor, credits and semester.
- Extract weekly topics.
- Extract reading list.
- Extract assignments, exams and grading structure.
- Show confidence for every extracted field.
- Confirmation and correction screen before applying changes.
- Duplicate-safe reimport.

### Course Workspace

- Course overview.
- Topics and weeks.
- Materials grouped by topic.
- Notes, cards and quizzes linked to the course.
- Course-level AI actions.
- Ask across all selected course sources.
- Create a combined exam pack.
- Identify uncovered syllabus topics.

### Course memory

Lamdan should know:

- which sources belong to the course;
- which terms are important;
- which outputs already exist;
- which syllabus topics have no material;
- which sources contradict or duplicate each other.

### Exit criteria

- Importing a syllabus creates a usable course structure.
- Adding later materials improves the same course context.
- The user no longer needs to re-explain the course to AI.

---

## Phase 5 — Notes as a real knowledge workspace

**Priority:** P1.

### Goal

Make notes the editable, connected center of understanding.

### Editor

- Rich-text or Markdown editing.
- Headings, lists, tables, quotes, callouts and checklists.
- RTL and mixed-direction editing.
- Inline source references.
- Links to materials, chunks, topics and other notes.
- Version history and autosave.
- Import existing notes.
- Export Markdown, DOCX and PDF.

### AI actions inside notes

- Rewrite selected text.
- Explain selected text.
- Translate while preserving terms.
- Expand or shorten.
- Convert selection to cards or questions.
- Compare note against source.
- Merge notes.
- Find contradictions and duplicates.
- Suggest questions for the lecturer.

### Exit criteria

- A student can use Lamdan as their main note workspace.
- Generated notes can evolve through manual editing without losing source links.

---

## Phase 6 — Flashcard and quiz studio

**Priority:** P1.

### Goal

Make generated practice content easy to curate and genuinely useful.

### Flashcard studio

- Decks by course, topic and material.
- Bulk editing.
- Merge, split and deduplicate cards.
- Import and export CSV and Anki-compatible formats.
- Review mode.
- Optional spaced repetition retained as a background mechanism, not a dashboard identity.

### Quiz studio

- Question editor.
- Reorder and categorize questions.
- Practice and exam modes.
- Configurable feedback timing.
- Question generation from one or several sources.
- Export printable exam and answer sheet.
- Import teacher question lists.

### Exit criteria

- AI-generated content can be corrected quickly.
- A user can build a high-quality exam set without recreating questions manually.

---

## Phase 7 — Audio, images and OCR

**Priority:** P1/P2.

### Goal

Support students who do not write complete lecture notes.

### Audio

- MP3, M4A and WAV upload.
- Lecture transcription.
- Speaker segmentation where possible.
- Timestamped transcript.
- Language and mixed-language detection.
- Link transcript sections to generated notes and cards.
- Optional live-recording workflow later.

### Images

- Photograph of a page, board or handwritten note.
- OCR for Hebrew and English.
- Manual correction screen.
- Image region selection.
- Diagram and table extraction where feasible.

### Video and links

- YouTube transcript import where legally and technically available.
- Web article extraction.
- URL metadata and source snapshot.

### Exit criteria

- A lecture recording can become a transcript, note, card set and quiz.
- OCR limitations are visible and correctable.

---

## Phase 8 — Cross-source search and course Q&A

**Priority:** P1.

### Goal

Make the full library searchable and answerable without losing source trust.

### Features

- Global full-text search.
- Search inside PDFs and transcripts.
- Natural-language search.
- Filters by course, topic, source type, language and date.
- Ask a question across selected courses or materials.
- Answers with source references.
- “Where did I study this?” retrieval.
- Compare theories or definitions across sources.
- Detect duplicate and conflicting explanations.

### Architecture

- Local index first.
- Embedding-based semantic search when backend infrastructure is introduced.
- Retrieval scoped explicitly by course and source permissions.

### Exit criteria

- The user can find a concept even when they do not remember the filename.
- Every AI answer can show where its claims came from.

---

## Phase 9 — Israeli academic intelligence

**Priority:** P1/P2.

### Goal

Build a defensible specialization beyond a generic document AI tool.

### Features

- Strong Hebrew academic language support.
- Russian explanations that preserve Hebrew terminology.
- University-specific syllabus patterns.
- Israeli semester and credit conventions.
- Common course structures and exam formats.
- Hebrew date, name and course-code extraction.
- Mixed RTL/LTR quality assurance.
- Optional Arabic UI and explanation support later.
- Institution templates for Bar-Ilan, Tel Aviv University, Hebrew University and others, added only after real data validation.

### Exit criteria

- Lamdan performs visibly better than a generic upload-to-chat workflow for Israeli study materials.

---

## Phase 10 — Accounts, cloud sync and reliability

**Priority:** after product validation.

### Goal

Move from a single-device tool to a dependable personal service.

### Features

- Authentication.
- Cloud database.
- Object storage for source files.
- Multi-device sync.
- Offline cache.
- Conflict handling.
- Automatic backups.
- Export all user data.
- Account deletion.
- Storage quotas.
- Background processing queue.
- Job retry and failure recovery.

### Migration rule

The current local-first data must be exportable and migratable. Cloud adoption must not silently erase existing local data.

### Exit criteria

- A user can switch devices without losing content.
- Long AI and transcription jobs survive browser closure.
- Data export and deletion work reliably.

---

## Phase 11 — Sharing and collaboration

**Priority:** P2.

### Goal

Allow useful sharing without turning Lamdan into a social network.

### Features

- Share a read-only note, card deck or quiz.
- Export a course pack.
- Collaborate on selected notes.
- Import another student's shared pack with provenance.
- Lecturer-provided source pack.
- Commenting and suggestions.
- Permissions and revocation.

### Explicit non-goals

- Public social feed.
- Follower system.
- Engagement mechanics.
- Marketplace before trust, moderation and copyright rules are solved.

---

## Phase 12 — Integrations and automation

**Priority:** P2.

### Features

- Google Drive import.
- Google Calendar export for extracted deadlines.
- Moodle or LMS import where technically permitted.
- Email attachment intake.
- Browser extension: save article to Lamdan.
- Mobile share sheet.
- API and webhooks for advanced users.

Automation examples:

- New material added to a course → classify and suggest outputs.
- New syllabus version uploaded → show changed dates and requirements.
- Lecture transcript ready → create draft note and suggested cards.

---

## Phase 13 — Mature study intelligence

**Priority:** only after the content system is trusted.

### Goal

Add adaptive learning without returning to meaningless tracking dashboards.

### Allowed intelligence

- Identify topics with repeated quiz errors.
- Recommend which source to reopen.
- Generate targeted practice from mistakes.
- Detect syllabus topics with no notes or practice content.
- Build an exam preparation pack.
- Estimate coverage, not fake mastery.

### Still not the product identity

- streaks;
- motivational badges;
- hours-studied vanity charts;
- always-visible timers;
- generic productivity scoring.

Any progress feature must lead directly to a content action.

---

## Phase 14 — Production product and monetization

**Priority:** after retention is proven.

### Product readiness

- Onboarding.
- Help and examples.
- Accessibility audit.
- Performance budgets.
- Error monitoring.
- Security review.
- Privacy policy and terms.
- Copyright and academic-integrity policy.
- AI cost controls.
- Abuse prevention.
- Support workflow.

### Possible plans

- Free: limited storage and AI transformations.
- Student: larger library, transcription and advanced generation.
- Pro: heavy usage, large courses and exports.
- Institutional pilot: managed cohorts or accessibility support, only after the personal product works.

### Core business metric

The strongest metric is not time spent in the app. It is:

> How many uploaded sources successfully become saved, reused study outputs?

---

# 6. Parallel engineering workstreams

## A. Data and domain model

- Keep source relationships first-class.
- Add stable deck or collection entities when needed.
- Add processing-job entities before background cloud jobs.
- Add migrations before changing stored schemas.
- Never infer mastery directly from file views.

## B. AI architecture

- Provider abstraction.
- Structured outputs validated by schemas.
- Retry and timeout behavior.
- Per-operation prompts rather than one universal chat prompt.
- Evaluation dataset using real Israeli academic documents.
- Cost and token accounting.
- Prompt and model versioning.

## C. Quality and evaluation

Create permanent evaluation sets for:

- Hebrew syllabus extraction;
- mixed-language document extraction;
- note completeness;
- flashcard quality;
- quiz distractor quality;
- citation correctness;
- hallucination rate;
- OCR and transcription accuracy.

## D. Privacy and safety

- Do not expose API keys in the browser.
- Minimize storage of source documents.
- Make deletion real and verifiable.
- Warn users before processing sensitive materials.
- Keep generated academic content distinguishable from original sources.

## E. UX consistency

- One design system.
- One universal intake model.
- One AI draft review pattern.
- One source-link pattern.
- Honest empty, loading, partial and error states.
- Desktop and mobile acceptance checks for every major workflow.

---

# 7. Priority map

## Now — P0

1. Stabilize the new shell and dashboard.
2. Finish universal material intake.
3. Build the Material Workspace.
4. Make note, flashcard and quiz generation excellent.
5. Complete syllabus → course structure flow.
6. Remove remaining fake or disconnected UI.
7. Add build, typecheck and smoke-test CI.

## Next — P1

1. Real note editor.
2. Flashcard and quiz studios.
3. Audio transcription.
4. OCR and image intake.
5. Global and semantic search.
6. Course-level AI.
7. Israeli academic specialization and evaluation.

## Later — P2

1. Accounts and cloud sync.
2. Sharing and collaboration.
3. Drive, Calendar and LMS integrations.
4. Adaptive exam preparation.
5. Paid plans and institutional pilots.

## Explicitly deferred

- streaks;
- generic productivity analytics;
- focus timers as a core screen;
- social network;
- public marketplace;
- native applications before the responsive web product is stable;
- broad institutional LMS features.

---

# 8. Immediate implementation sequence

The next development sequence should be atomic and testable:

1. Add CI for build, typecheck and lint.
2. Audit all current routes against the new shell.
3. Remove or hide tracking-first routes from primary product flows.
4. Finish multi-file upload and processing queue.
5. Create a polished material detail workspace.
6. Connect AI actions directly to selected chunks.
7. Improve the draft editor and save flow.
8. Add an output history to every material.
9. Complete syllabus review and confirmation UI.
10. Build a course workspace using real topics and materials.
11. Upgrade Notes into a serious editor.
12. Add bulk card and quiz editing.
13. Create real-world evaluation fixtures in Hebrew, Russian and English.
14. Run the first closed personal pilot using one complete real course.

The first major product milestone is reached when one real Israeli course can live entirely inside Lamdan from syllabus import through exam preparation.

# 9. Milestone definitions

## M1 — Useful personal tool

A single user can import a course, upload materials, generate and edit outputs, and return to them reliably.

## M2 — Complete semester workspace

A user can manage several active courses, recordings and mixed-language sources without losing context.

## M3 — Closed student beta

A small group of Israeli students can onboard themselves and complete the core loop without developer assistance.

## M4 — Cloud product

Accounts, sync, reliable background jobs and privacy controls are production-ready.

## M5 — Differentiated Israeli study platform

Lamdan demonstrates superior handling of Israeli syllabi, Hebrew academic content and multilingual explanation workflows.

# 10. Product decision rule

Before adding any feature, ask:

1. Does it help ingest, understand, transform, connect, retrieve or practice academic content?
2. Does it reduce repeated prompting or repeated organization work?
3. Can it preserve or improve source trust?
4. Will a student use it in a real course this semester?

If the answer is no, the feature does not belong in the core roadmap.
