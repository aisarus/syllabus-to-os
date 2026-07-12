# Lamdan — Full Product Roadmap

## 1. Product definition

Lamdan is an AI-first study-content workspace for university and pre-academic students in Israel.

The product accepts academic chaos — syllabi, PDFs, presentations, documents, spreadsheets, pasted text, photographs, handwritten notebooks, whiteboards, links and lecture recordings — and turns it into a structured, reusable study system:

- courses and topics;
- extracted and searchable source materials;
- reviewed OCR and lecture transcripts;
- clear notes and explanations;
- flashcards;
- quizzes and exam practice;
- source-linked knowledge that can be regenerated, merged and reused.

Lamdan is not primarily a timer, habit tracker, calendar dashboard, streak app or analytics product.

The core promise is:

> Upload any study source once. Lamdan preserves it, helps you verify what it understood and turns the approved content into every study format you need.

## 2. Target user

### Primary user

A university or pre-academic student in Israel who studies in Hebrew or English but may think and understand better in Russian, Arabic or another language.

### Primary pains

- Course materials are spread across Moodle, WhatsApp, email, Google Drive, recordings, photographs and personal files.
- The student partially understands Hebrew academic content.
- The student does not reliably write notes during class.
- The student depends on other students' notes but does not fully understand them.
- Important material exists only as a phone photo, handwritten notebook page or whiteboard.
- Mathematics written by hand is difficult to reuse because ordinary OCR loses signs, exponents and intermediate steps.
- ChatGPT can process a source, but the student must repeatedly upload context and recreate prompts.
- Notes, cards and quizzes are disconnected from the original source and from one another.
- The student has no persistent course-level memory.

## 3. Product principles

1. **Content first.** Every major feature must improve ingestion, understanding, transformation or retrieval of study content.
2. **Maximum useful autonomy.** Lamdan should infer material type, language, course and useful next actions with minimal configuration.
3. **Human confirmation before persistence.** AI-generated and OCR-generated outputs remain editable drafts until the user explicitly applies or saves them.
4. **Sources remain visible.** Notes, cards, answers and quiz questions preserve links to source chunks, pages, timestamps or image regions where available.
5. **Mixed-language by design.** Hebrew, Russian, English and Arabic may coexist inside one course, document or photographed page.
6. **OCR is ingestion, not a late add-on.** A phone photo and a PDF are both first-class study sources.
7. **Uncertainty must be visible.** Unreadable handwriting, ambiguous symbols and low-confidence regions must trigger review or abstention rather than invention.
8. **Mathematics is structured content.** Visible handwriting and normalized expressions are preserved separately; one never silently replaces the other.
9. **No fake intelligence.** Never invent progress, mastery, citations, source support, missing words or mathematical steps.
10. **One stable interface.** The permanent visual foundation is Academic Content Workspace, not an illustrated room.
11. **Local-first until the core loop is excellent.** Cloud infrastructure should not slow down product validation.

## 4. Current baseline

The repository currently contains:

- local-first application data;
- courses and topics;
- universal multi-file material intake;
- text extraction for common document formats;
- persistent material chunks and source relationships;
- material workspaces;
- notes, flashcards and quizzes with real editors;
- syllabus import and course-workspace foundations;
- server-side AI routes for study transformations;
- editable AI drafts and citation validation;
- deterministic evaluation fixtures for syllabus, grounding, multilingual output and OCR;
- an OCR/HTR data contract for regions, confidence, uncertainty and normalized mathematics;
- RU/EN application localization;
- the Academic Content Workspace shell and dashboard.

The current execution path is:

```text
import syllabus or create course
→ upload document or photograph
→ extract text or create reviewed OCR draft
→ approve source chunks
→ generate note, flashcards and quiz
→ review and save outputs
→ return later with source relationships intact
```

---

# 5. Delivery roadmap

## Phase 0 — Foundation lock

**Status:** complete.

### Goal

Freeze the product identity, visual system and architectural boundaries so later work does not repeatedly redesign the product.

### Scope

- Permanent Academic Content Workspace design.
- Primary navigation limited to Courses, Materials, Notes, Flashcards and Quizzes.
- Trackers, timers, streaks and decorative analytics removed from the core shell.
- Design and agent guardrails committed to the repository.
- Existing local data remains migratable.

### Exit criteria

- No generated room backgrounds or fixed visual canvases.
- All primary UI uses the shared layout and token system.
- Dashboard shows only real content or honest empty states.

---

## Phase 1 — Reliable universal intake

**Priority:** P0.

**Status:** document intake complete; durable image intake and OCR review in progress.

### Goal

Make Lamdan the easiest place to put any study source, including a photograph taken directly from a student's phone.

### User experience

The user can drag, paste or upload a source into one universal intake. Lamdan determines what it is, extracts what it can, preserves the original source, reports limitations honestly and sends uncertain content to review.

### Document intake

- Dashboard and Materials share one intake pipeline.
- Multi-file queue with independent retry and failure states.
- Pasted text.
- PDF, DOCX, XLSX, CSV, TXT, Markdown, HTML, JSON, XML and YAML.
- Reliable duplicate detection.
- File type and material type classification.
- Automatic language detection: Hebrew, Russian, English, Arabic, mixed or unknown.
- Suggested course and topic association.
- File metadata and extraction diagnostics.
- Preview before persistence.

### Image and OCR intake

- JPEG, PNG and WebP upload from Dashboard and Materials.
- Durable local image storage so the original survives reload.
- Source-style selection: printed page, handwriting, whiteboard or mixed page.
- Multimodal OCR/HTR request behind a provider boundary.
- Editable OCR draft instead of automatic trusted text.
- Ordered regions with text, kind, confidence, uncertain tokens and optional image coordinates.
- Separate visible transcription and normalized mathematics.
- Manual transcription fallback when AI is unavailable.
- Explicit abstention for unreadable images.
- Apply reviewed OCR regions as normal material chunks.

### Processing states

- queued;
- extracting;
- awaiting review;
- ready;
- partial;
- unsupported;
- error;
- cancelled.

### Israeli specialization

- Hebrew and RTL-safe previews.
- Mixed Hebrew/Russian/English region editing.
- Hebrew cursive handwriting is treated as uncertain by default.
- Israeli course-code and syllabus heuristics.
- Recognition of common Hebrew academic headings.
- Mathematics keeps left-to-right expressions readable inside RTL instructions.

### Exit criteria

- A user can upload a real mixed course pack without losing failed files.
- A photograph survives page reload before OCR is run.
- The user can compare the image with an editable OCR draft.
- Handwritten math preserves signs, variables and intermediate steps after review.
- Unsupported or unreadable content is never reported as clean extracted text.
- Approved text survives reload and becomes normal source chunks.

---

## Phase 2 — Material Workspace

**Priority:** P0.

**Status:** core workspace complete; visual-source layer in progress.

### Goal

Turn every uploaded material into an active source workspace rather than a dead file entry.

### Core screen

Each material can expose:

- original document, image or transcript context;
- page, timestamp or OCR-region navigation;
- reviewed text and selectable chunks;
- actions and generated outputs.

### Features

- Material overview and metadata.
- Chunk and page navigation.
- Search inside a material.
- Select one or multiple chunks.
- Rename, tag and link to course/topic.
- Manual correction of extracted text.
- Split, merge, reorder and delete chunks safely.
- Source page or section references where available.
- Existing outputs panel for notes, cards, quizzes and outlines.
- Quick actions: explain, summarize, translate, simplify, create note, create cards and create quiz.

### Visual-source workspace

- Original image and OCR editor on the same screen.
- Region ordering and classification: heading, paragraph, list, math, table, diagram or unknown.
- Low-confidence and uncertain-token indicators.
- Manual region creation and deletion.
- Visible mathematical transcription plus normalized expression.
- Future image overlay using normalized region coordinates.
- Re-run OCR without overwriting the last approved material text.
- Explicit apply action that replaces source chunks only after review.

### Exit criteria

- A user can identify exactly which source sections will be sent to AI.
- Every saved output preserves material and chunk relationships.
- A photographed source remains inspectable after OCR is applied.
- OCR reruns do not silently overwrite reviewed text.
- The material page is the main origin point for content generation.

---

## Phase 3 — Autonomous, source-grounded transformation

**Priority:** P0.

**Status:** first complete loop implemented; quality hardening continues.

### Goal

Make the central Lamdan promise real: one approved source becomes multiple high-quality study formats with minimal prompting.

### AI pipeline

1. Detect material type, source language and likely course context.
2. Extract document text or obtain a reviewed OCR/transcript draft.
3. Let the user approve the source chunks.
4. Suggest useful transformations.
5. Generate an editable draft.
6. Show source support and warnings.
7. Save only after confirmation.

Unreviewed OCR guesses must not be treated as stronger evidence than the approved material chunks.

### Note generation

- Structured lecture note.
- Short summary.
- Detailed explanation.
- Key concepts and definitions.
- Russian explanation with original Hebrew or English terms preserved.
- Compare source with an existing note and show missing content.
- Merge several approved sources into one note.

### Flashcard generation

- Term → definition.
- Question → answer.
- Cloze deletion.
- Hebrew ↔ Russian and Hebrew ↔ English cards.
- Card quality cleanup.
- Duplicate detection.
- Split overloaded cards.
- No card when the supporting answer is absent from approved sources.

### Quiz generation

- Single-choice and multiple-choice questions.
- True/false and short answer later.
- Realistic wrong answers.
- Explanations linked to source chunks.
- Difficulty and question-count controls.
- No invented mathematical result from an ambiguous photographed solution.

### AI trust layer

- Source citations.
- “Not found in selected sources” state.
- Confidence and warning labels where relevant.
- Unknown source IDs removed.
- Regenerate one item rather than the whole output.
- Never overwrite user content silently.

### Exit criteria

- From one approved material, the user can save a useful note, card set and quiz without a complex prompt.
- Outputs remain editable.
- Source relationships remain intact.
- AI and OCR failures do not destroy or duplicate approved content.

---

## Phase 4 — Course Workspace and syllabus intelligence

**Priority:** P0/P1.

**Status:** v1 implemented; deeper intelligence continues.

### Goal

Turn a syllabus into a persistent course brain.

### Syllabus import

- PDF, DOCX, XLSX, photograph and pasted-text syllabus intake.
- Photographed syllabus first passes through the normal OCR review workflow.
- Extract course title, code, instructor, credits and semester.
- Extract weekly topics, reading list, assignments, exams and grading structure.
- Show confidence for every extracted field.
- Confirmation and correction before applying changes.
- Duplicate-safe reimport.

### Course Workspace

- Course overview.
- Topics and weeks.
- Materials grouped by topic.
- Notes, cards and quizzes linked to the course.
- Course-level AI actions.
- Ask across explicitly selected course sources.
- Create a combined exam pack.
- Identify uncovered syllabus topics.

### Course memory

Lamdan should know:

- which sources belong to the course;
- which source text was manually approved;
- which terms are important;
- which outputs already exist;
- which syllabus topics have no material;
- which sources contradict or duplicate each other.

### Exit criteria

- Importing a digital or photographed syllabus creates a usable course structure.
- Adding later documents, recordings and photographs improves the same course context.
- The user no longer needs to re-explain the course to AI.

---

## Phase 5 — Notes as a real knowledge workspace

**Priority:** P1.

**Status:** reliable Markdown editor v1 implemented.

### Goal

Make notes the editable, connected center of understanding.

### Editor

- Markdown or rich-text editing.
- Headings, lists, tables, quotes, callouts and checklists.
- RTL and mixed-direction editing.
- Inline source references.
- Links to materials, chunks, topics and other notes.
- Version history and autosave.
- Import existing notes.
- Export Markdown, DOCX and PDF.

### AI actions inside notes

- Rewrite, explain, translate, expand or shorten selected text.
- Preserve original Hebrew terminology.
- Convert selection to cards or questions.
- Compare note against sources.
- Merge notes.
- Find contradictions and duplicates.
- Suggest questions for the lecturer.

### Exit criteria

- A student can use Lamdan as the main note workspace.
- Generated notes can evolve through manual editing without losing source links.

---

## Phase 6 — Flashcard and quiz studios

**Priority:** P1.

**Status:** v1 implemented.

### Flashcard studio

- Cards grouped by course, topic and material.
- Bulk editing.
- Merge, split and deduplicate cards.
- CSV import/export and later Anki-compatible formats.
- Review mode.
- Optional spaced repetition as a background mechanism, not a dashboard identity.

### Quiz studio

- Full question editor.
- Reorder and validate questions.
- Practice and exam modes.
- Configurable feedback timing.
- Generation from one or several approved sources.
- Export printable exam and answer sheet.
- Import teacher question lists.

### Exit criteria

- AI-generated practice content can be corrected quickly.
- A user can build a high-quality exam set without recreating every item manually.

---

## Phase 7 — Audio, video and advanced visual understanding

**Priority:** P1/P2.

**Important:** basic photo intake, OCR, handwriting review and photographed mathematics belong to Phases 1–2. They are no longer postponed to this phase.

### Goal

Support sources that require long-running transcription or deeper visual interpretation.

### Audio

- MP3, M4A and WAV upload.
- Lecture transcription.
- Speaker segmentation where possible.
- Timestamped transcript.
- Hebrew and mixed-language detection.
- Link transcript sections to generated notes and cards.
- Optional live recording later.

### Advanced visual understanding

- Multi-page photo batches.
- Crop, rotate, deskew and contrast controls.
- Image-region overlay and selection.
- Table reconstruction.
- Diagram-label extraction.
- Geometry and chart descriptions limited to visible evidence.
- Comparison of OCR providers using the permanent evaluation suite.

### Video and links

- YouTube transcript import where legally and technically available.
- Web article extraction.
- URL metadata and source snapshot.

### Exit criteria

- A lecture recording can become a reviewed transcript, note, card set and quiz.
- Complex visual sources remain correctable and source-linked.

---

## Phase 8 — Cross-source search and course Q&A

**Priority:** P1.

### Goal

Make the full library searchable and answerable without losing source trust.

### Features

- Global full-text search.
- Search inside PDFs, approved OCR text and transcripts.
- Natural-language search.
- Filters by course, topic, source type, language and date.
- Ask across selected courses or materials.
- Answers with source references.
- “Where did I study this?” retrieval.
- Compare theories or definitions across sources.
- Detect duplicate and conflicting explanations.

### Architecture

- Local index first.
- Embedding-based semantic search when backend infrastructure is introduced.
- Retrieval scoped explicitly by course and source permissions.

### Exit criteria

- The user can find a concept without remembering the filename or whether it came from a PDF, photo or recording.
- Every AI answer can show where its claims came from.

---

## Phase 9 — Israeli academic intelligence

**Priority:** P1/P2.

### Goal

Build a defensible specialization beyond a generic document-AI tool.

### Features

- Strong Hebrew academic language support.
- Russian explanations that preserve Hebrew terminology.
- Hebrew printed and handwritten evaluation sets.
- University-specific syllabus patterns.
- Israeli semester and credit conventions.
- Common course structures and exam formats.
- Hebrew date, name and course-code extraction.
- Mixed RTL/LTR quality assurance, including mathematics.
- Optional Arabic UI and explanation support later.
- Institution templates only after real-data validation.

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
- Object storage for documents, images and recordings.
- Multi-device sync.
- Offline cache.
- Conflict handling.
- Automatic backups.
- Export all user data, including original visual sources.
- Account deletion.
- Storage quotas.
- Background processing queue.
- Long OCR and transcription job retry.

### Migration rule

Current local-first text data, OCR drafts and IndexedDB image sources must have an explicit migration path. Cloud adoption must not silently erase or strand local content.

### Exit criteria

- A user can switch devices without losing approved text or original sources.
- Long OCR and transcription jobs survive browser closure.
- Export and deletion work reliably.

---

## Phase 11 — Sharing and collaboration

**Priority:** P2.

### Goal

Allow useful sharing without turning Lamdan into a social network.

### Features

- Share a read-only note, deck or quiz.
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
- Mobile share sheet for sending photographs directly to intake.
- API and webhooks for advanced users.

Automation examples:

- New material added → classify and suggest outputs.
- New photograph added → create OCR draft and wait for review.
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
- Build an exam-preparation pack.
- Estimate content coverage, not fake mastery.

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
- AI and OCR cost controls.
- Abuse prevention.
- Support workflow.

### Possible plans

- Free: limited storage, OCR pages and AI transformations.
- Student: larger library, transcription and advanced generation.
- Pro: heavy usage, large courses and exports.
- Institutional pilot: managed cohorts or accessibility support only after the personal product works.

### Core business metric

The strongest metric is not time spent in the app. It is:

> How many uploaded sources successfully become approved, saved and reused study outputs?

---

# 6. Parallel engineering workstreams

## A. Data and domain model

- Keep source relationships first-class.
- Add stable deck or collection entities when needed.
- Add processing-job entities before background cloud jobs.
- Add migrations before changing stored schemas.
- Preserve original visual source, OCR draft and approved text as separate layers.
- Never infer mastery directly from file views.

## B. AI and OCR architecture

- Provider abstraction.
- Structured outputs validated by schemas.
- Multimodal requests isolated behind a server boundary.
- Retry, timeout and rate-limit behavior.
- Per-operation prompts rather than one universal chat prompt.
- Prompt and model versioning.
- Cost and token accounting.
- OCR provider comparison on private or licensed real-photo packs.

## C. Quality and evaluation

Maintain permanent evaluation sets for:

- Hebrew syllabus extraction;
- mixed-language document extraction;
- note completeness;
- flashcard quality;
- quiz distractor quality;
- citation correctness;
- hallucination rate;
- printed Hebrew OCR;
- handwritten Hebrew HTR;
- photographed mathematics;
- unreadable-image abstention;
- audio transcription accuracy.

## D. Privacy and safety

- Do not expose API keys in the browser.
- Minimize storage of source documents.
- Explain clearly that browser-local images are not automatically cloud-backed.
- Make deletion real and verifiable across localStorage, IndexedDB and future cloud storage.
- Warn users before processing sensitive materials.
- Keep generated academic content distinguishable from original sources.

## E. UX consistency

- One design system.
- One universal intake model for documents and photographs.
- One editable draft-review pattern for AI, OCR and transcripts.
- One source-link pattern.
- Honest empty, loading, partial, review and error states.
- Desktop and mobile acceptance checks for every major workflow.

---

# 7. Priority map

## Now — P0

1. Keep the shell, routes and CI stable.
2. Complete durable image intake and OCR review.
3. Validate live OCR on real printed Hebrew, handwriting and mathematics.
4. Harden source-grounded note, flashcard and quiz generation.
5. Complete syllabus → course structure flow for digital and photographed syllabi.
6. Run a closed personal pilot with one complete real course.

## Next — P1

1. Audio transcription.
2. Multi-page image batches and visual-region overlays.
3. Global and semantic search across documents, OCR and transcripts.
4. Course-level AI and exam-pack generation.
5. Israeli academic specialization and evaluation.
6. Rich note export and advanced source comparison.

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

Completed sequence:

1. Add CI for build, typecheck and lint.
2. Normalize routes and remove tracking-first primary flows.
3. Complete universal document intake and multi-file queue.
4. Build Material Workspace, source selection and output history.
5. Connect grounded AI actions and editable drafts.
6. Complete syllabus review and Course Workspace v1.
7. Build reliable Notes, Flashcard Studio and Quiz Studio.
8. Remove remaining fake and disconnected UI.
9. Add deterministic evaluation fixtures, including OCR and handwriting.

Current sequence:

10. Store uploaded photographs durably in the browser.
11. Connect multimodal OCR/HTR behind the provider boundary.
12. Build side-by-side image and OCR-region review.
13. Apply reviewed OCR to ordinary material chunks.
14. Validate on a private real-photo pack and fix failure categories.
15. Add multi-page image intake and visual overlays.
16. Add audio transcription with the same review-and-apply model.
17. Run the first closed personal pilot using one complete real course.

The first major product milestone is reached when one real Israeli course can live entirely inside Lamdan from photographed or digital syllabus import through exam preparation.

# 9. Milestone definitions

## M1 — Useful personal tool

A single user can import a course, upload documents or photographs, approve extracted content, generate and edit outputs and return to them reliably.

## M2 — Complete semester workspace

A user can manage several active courses, recordings and mixed-language sources without losing context.

## M3 — Closed student beta

A small group of Israeli students can onboard themselves and complete the core loop without developer assistance.

## M4 — Cloud product

Accounts, sync, reliable background jobs, source storage and privacy controls are production-ready.

## M5 — Differentiated Israeli study platform

Lamdan demonstrates superior handling of Israeli syllabi, Hebrew academic content, handwriting, photographed mathematics and multilingual explanation workflows.

# 10. Product decision rule

Before adding any feature, ask:

1. Does it help ingest, understand, transform, connect, retrieve or practice academic content?
2. Does it reduce repeated prompting or repeated organization work?
3. Can it preserve or improve source trust?
4. Will a student use it in a real course this semester?
5. For visual sources, does it preserve the original and expose uncertainty rather than hiding it?

If the answer is no, the feature does not belong in the core roadmap.
