# Lamdan — Full Product Roadmap

## 1. Product definition

Lamdan is an AI-first Academic Autopilot for university and pre-academic students in Israel.

The product accepts academic chaos — syllabi, PDFs, presentations, spreadsheets, pasted text, photographs, handwritten notebooks, whiteboards, links, assignments and lecture recordings — and turns it into a reliable study system that answers four questions:

1. What did the university give me?
2. What does it mean?
3. What should I do now?
4. Am I actually ready for the assessment?

The core promise is:

> Capture anything → understand it → learn it → remember it → pass the exam.

Lamdan should reduce the student's total planning, preparation, retrieval and revision burden by at least 30% during a real course. It must do this by removing repeated work, not by hiding work behind fake progress scores.

## 2. Product identity

Lamdan is not another notes app, generic AI chat, timer, streak tracker or dashboard of vanity analytics.

It is a persistent course brain and daily decision system:

- upload once;
- preserve the source;
- verify what Lamdan understood;
- generate reusable study outputs;
- observe real deadlines and learning evidence;
- recommend the highest-value next action;
- adapt the study route as evidence changes.

## 3. Target user

### Primary user

A university or pre-academic student in Israel who studies in Hebrew or English but may understand explanations better in Russian, Arabic or another language.

### Primary pains

- Materials are scattered across Moodle, WhatsApp, email, Drive, recordings and photographs.
- Academic Hebrew creates extra cognitive load.
- The student does not know what is important, what is missing or what to do first.
- Notes, cards, quizzes and assignments are disconnected from their sources.
- Exam preparation begins too late because future workload is invisible.
- Generic AI repeatedly needs the same context and may invent unsupported details.
- Handwritten Hebrew and mathematics are difficult to digitize safely.
- The student spends excessive time organizing learning instead of learning.

## 4. Product principles

1. **Content first.** Every major feature must improve capture, understanding, transformation, retrieval, practice or assessment readiness.
2. **Maximum useful autonomy.** Lamdan should infer material type, language, course, deadlines and useful next actions with minimal configuration.
3. **Human confirmation before persistence.** AI, OCR and transcript results remain editable drafts until explicit save or apply.
4. **Sources remain visible.** Notes, cards, answers and questions preserve links to chunks, pages, timestamps or image regions.
5. **Mixed-language by design.** Hebrew, Russian, English and Arabic may coexist inside one course or source.
6. **OCR is ingestion, not a late add-on.** A phone photo and a PDF are both first-class study sources.
7. **Uncertainty must be visible.** Unreadable handwriting, ambiguous symbols and weak evidence trigger review or abstention rather than invention.
8. **Mathematics is structured content.** Visible handwriting and normalized expressions are preserved separately.
9. **No fake intelligence.** Never invent mastery, citations, progress, missing words, deadlines or mathematical steps.
10. **Every metric leads to an action.** A red signal must open the exact source, practice or task that can improve it.
11. **Local-first until the core loop is excellent.** Cloud infrastructure must not delay product validation.
12. **One coherent interface.** Academic Content Workspace remains the visual foundation; depth, motion and pseudo-3D support hierarchy rather than decoration.
13. **Progress is evidence-based.** File views do not equal learning. Recognition does not equal recall. Recall does not equal application.
14. **The next action must be explainable.** The student can see why Lamdan prioritized something.

## 5. Current baseline

The repository currently contains:

- local-first application data;
- courses and topics;
- universal multi-file material intake;
- durable single and multi-page visual sources;
- reviewed OCR/HTR drafts and source regions;
- source-linked material chunks;
- Material Workspace;
- reliable notes, flashcards and quizzes;
- syllabus review and Course Workspace foundations;
- server-side grounded AI transformations;
- local multilingual global search;
- persistence and source-integrity protection;
- deterministic evaluation suites and critical browser E2E;
- RU/EN application localization;
- Academic Content Workspace design system.

The proven technical loop is:

```text
import syllabus or create course
→ upload document or photograph
→ extract text or create reviewed OCR draft
→ approve source chunks
→ generate note, flashcards and quiz
→ review and save outputs
→ return later with source relationships intact
```

The next product loop is:

```text
observe deadlines + source state + review state + assessment evidence
→ choose the highest-value next action
→ build a bounded study session
→ record real outcome
→ update the next action
```

---

# 6. Delivery roadmap

## Phase 0 — Foundation lock

**Status:** complete.

### Goal

Freeze product identity, data trust boundaries, design system and quality gates.

### Exit criteria

- Academic Content Workspace is the permanent shell.
- No fake demo analytics appear as user data.
- Existing local data remains migratable.
- CI covers contracts, deterministic evals, types, lint, build and critical Chromium flows.

---

## Phase 1 — Reliable universal intake

**Priority:** P0.  
**Status:** implementation complete; private live-photo validation remains.

### Goal

Make Lamdan the easiest place to put any study source.

### Document intake

- Dashboard and Materials share one pipeline.
- Multi-file queue with independent retry and failure states.
- Pasted text.
- PDF, DOCX, XLSX, CSV, TXT, Markdown, HTML, JSON, XML and YAML.
- Duplicate detection.
- File type, material type and language classification.
- Suggested course/topic association.
- Preview and correction before persistence.

### Image and OCR intake

- JPEG, PNG and WebP from desktop or phone.
- Store uploaded photographs durably in the browser.
- Source-style selection: print, handwriting, whiteboard or mixed.
- Non-destructive crop, rotation, deskew, grayscale, brightness, contrast, threshold and sharpening.
- Separate original, processing recipe, preview, OCR draft and approved text.
- Ordered regions with confidence, uncertainty and coordinates.
- Separate visible mathematical transcription and normalized math.
- Manual transcription fallback.
- Explicit abstention for unreadable images.

### Processing states

- queued;
- extracting;
- awaiting review;
- ready;
- partial;
- unsupported;
- error;
- cancelled.

### Exit criteria

- A mixed course pack can be uploaded without one failed source stopping the queue.
- Photographs survive reload before OCR.
- Approved text survives reload and becomes normal source chunks.
- Unsupported or unreadable content is never reported as clean extracted text.

---

## Phase 2 — Material Workspace

**Priority:** P0.  
**Status:** core and visual-source workspace implemented.

### Goal

Turn each upload into an active source workspace rather than a dead file.

### Features

- Original source context with page, timestamp or OCR-region navigation.
- Reviewed text and selectable chunks.
- Search inside material.
- Rename, classify, tag and link to course/topic.
- Split, merge, reorder and delete chunks safely.
- Existing outputs panel.
- Quick actions: explain, summarize, translate, simplify, note, cards and quiz.

### Visual-source workspace

- Image and OCR editor side by side.
- Region ordering and classification.
- Low-confidence indicators and uncertain tokens.
- Manual region creation and normalized-coordinate editing.
- Re-run OCR without overwriting approved text.
- Multi-page ordering, partial success and source-safe backup.

### Boundary

The basic photo intake, OCR, handwriting review and photographed mathematics belong to Phases 1–2. Audio and advanced diagram interpretation do not postpone them.

---

## Phase 3 — Source-grounded transformation

**Priority:** P0.  
**Status:** first complete loop implemented; quality hardening continues.

### Goal

One approved source becomes multiple high-quality study formats with minimal prompting.

### Outputs

- structured note;
- short summary;
- detailed explanation;
- key concepts;
- Russian explanation preserving Hebrew or English terms;
- flashcards by multiple memory patterns;
- grounded quiz with realistic distractors;
- presentation outline;
- comparison against existing notes;
- merged output from several selected sources.

### Trust requirements

- Unsupported claims are rejected or visibly warned.
- Unknown chunk IDs are removed.
- One item can be regenerated without replacing the full draft.
- User content is never overwritten silently.
- Ambiguous photographed mathematics is never completed or solved by OCR.

---

## Phase 4 — Course Workspace and syllabus intelligence

**Priority:** P0/P1.  
**Status:** v1 implemented; deeper intelligence continues.

### Goal

Turn a syllabus into a persistent course brain.

### Syllabus import

- digital, photographed and pasted syllabus intake;
- course metadata, topics, readings, assessments and grading extraction;
- field-level confidence and correction;
- duplicate-safe reimport;
- changed-date and changed-requirement detection later.

### Course memory

Lamdan knows:

- which sources belong to the course;
- which chunks were approved;
- which concepts and terms are important;
- which outputs exist;
- which syllabus topics have no source or practice;
- which sources duplicate or contradict each other;
- which assessments and deadlines belong to the course.

---

## Phase 5 — Study Command Center

**Task:** P1-011.  
**Priority:** immediate product layer.  
**Status:** v1 implemented in the current branch.

### Goal

Answer one question every time the student opens Lamdan:

> What should I do now?

### V1 evidence inputs

- overdue and upcoming assignments;
- upcoming exam events;
- due flashcards;
- latest quiz attempts;
- source processing and review state;
- recent ready materials without outputs;
- courses without sources;
- real study-session records.

### V1 experience

- one main action;
- explainable reason and estimated duration;
- 20, 45 and 90 minute bounded plans;
- quick wins;
- visible risks and gaps;
- honest counters based on stored data;
- direct links into the exact course, source, quiz, cards or assignment.

### Non-negotiable boundary

The command center may prioritize only evidence that exists. It must not infer mastery from views, scrolling or file count.

### Exit criteria

- Empty workspace produces an intake action, not fake progress.
- An overdue assignment outranks optional generation.
- An imminent exam without practice creates a visible risk.
- Every recommendation opens a useful next screen.
- Mobile layout remains operable.

---

## Phase 6 — Lecture-to-Study-Pack

**Task:** P1-012.  
**Priority:** P1.

### Goal

Turn one lecture or source bundle into a complete guided learning sequence.

### Study Pack contents

- concise orientation;
- structured note;
- key concepts and definitions;
- difficult points explained simply;
- bilingual terminology;
- source-linked flashcards;
- diagnostic questions;
- realistic exam questions;
- unclear or unsupported areas;
- recommended sequence with time estimates.

### Input bundle

A pack may combine:

- presentation;
- lecture PDF;
- personal notes;
- board photographs;
- reviewed transcript;
- assigned reading.

### One-click experience

The primary action is:

> Prepare me from this lecture.

Lamdan returns a bounded sequence such as orientation → explanation → cards → questions → mistake repair, rather than separate disconnected artifacts.

### Exit criteria

- The pack never cites unapproved OCR/transcript text as trusted evidence.
- All generated items preserve source links.
- Duplicate cards and questions are removed.
- The user can regenerate or replace one section independently.

---

## Phase 7 — Concepts and evidence-based mastery

**Task:** P1-013.  
**Priority:** P1 after Study Pack.

### Goal

Model what the student has encountered, recalled and applied without pretending certainty.

### Concept state

Each concept may collect evidence for:

- source coverage;
- recognition;
- recall;
- explanation;
- application;
- repeated error;
- forgetting risk;
- last successful evidence.

### Knowledge map

- concepts connected to topics, sources and assessments;
- green: repeated strong evidence;
- yellow: fragile or old evidence;
- red: repeated errors or missing prerequisite;
- gray: not yet encountered.

### Evidence sources

- card review outcomes;
- quiz answers and error categories;
- open-answer rubric checks;
- oral responses later;
- explicit self-rating only as a secondary signal.

### Forbidden shortcuts

- file opened = learned;
- note created = understood;
- time spent = mastery;
- one lucky multiple-choice answer = stable knowledge.

---

## Phase 8 — Exam Engine

**Task:** P1-014.  
**Priority:** P1.

### Goal

Build an adaptive preparation strategy from the assessment date, format, source coverage, available time and real learning evidence.

### Modes

- calm semester;
- week before exam;
- exam tomorrow;
- closed multiple-choice test;
- open questions;
- oral exam;
- exam in Hebrew;
- emergency two-hour mode.

### Features

- exam date and format;
- topic weighting;
- content coverage;
- readiness dimensions rather than one magical score;
- bounded daily plan;
- simulation under real conditions;
- error analysis;
- targeted repair;
- estimate range with transparent assumptions;
- automatic re-planning after each session.

### Readiness dimensions

- source coverage;
- recall evidence;
- application evidence;
- practice coverage;
- recency and forgetting risk.

A readiness number may appear only when the dimensions and uncertainty are visible.

---

## Phase 9 — Assignment Copilot

**Task:** P1-015.  
**Priority:** P1.

### Goal

Reduce the organizational and reasoning overhead of completing assignments without silently doing the student's assessed work.

### Workflow

1. Extract requirements, format, deadline and rubric.
2. Identify mandatory sources and constraints.
3. Break the work into stages.
4. Build thesis, outline and evidence map.
5. Track unresolved requirements.
6. Review a draft against the task and rubric.
7. Validate citations and unsupported claims.
8. Produce a final submission checklist.

### Key action

> Review this through the lecturer's eyes.

### Academic-integrity boundary

Lamdan may scaffold, critique, explain and check. It must label generated text and avoid presenting unsupported generation as the student's verified analysis.

---

## Phase 10 — Audio, Lecture Mode and advanced visual understanding

**Tasks:** P1-010 and P1-016.  
**Priority:** after M1 validation.

### Audio transcription

- MP3, M4A and WAV;
- timestamped transcript;
- speaker and language uncertainty;
- review-and-apply model matching OCR;
- retry, cancellation and timeout;
- links from outputs to transcript sections.

### Lecture Mode

During class:

- record audio where legally permitted;
- write quick notes;
- capture board photographs;
- mark important, unclear and likely-exam moments;
- bind notes and photographs to timestamps.

After class:

- show marked unclear moments;
- compare lecturer wording with slides;
- identify repeated emphasis;
- produce a reviewed Study Pack.

### Advanced visual understanding

- table reconstruction;
- diagram labels;
- chart and geometry descriptions limited to visible evidence;
- page-aware multi-image regions;
- provider comparison on licensed evaluation packs.

---

## Phase 11 — Ask My Course and cross-source intelligence

**Task:** P1-017.  
**Priority:** P1.

### Goal

Answer questions across the student's actual course without losing source trust.

### Commands

- explain simply;
- explain in Russian while preserving Hebrew terms;
- show where the lecturer said it;
- compare definitions across sources;
- identify contradictions;
- check my answer only against selected sources;
- guide me without giving the answer;
- propose questions for the lecturer.

### Architecture

- local lexical search first;
- semantic retrieval after backend infrastructure;
- explicit scope by course and selected sources;
- every claim opens its source.

---

## Phase 12 — Intelligent calendar and workload forecast

**Task:** P1-018.  
**Priority:** P1/P2.

### Goal

Show future academic pressure before it becomes a crisis.

### Features

- extract deadlines and exams from syllabi, assignments and messages;
- split large tasks into stages;
- estimate work using actual past completion evidence;
- detect overloaded weeks;
- show preparation debt;
- suggest earlier starts and lower-priority tradeoffs;
- export confirmed dates to Google Calendar later.

### Boundary

Lamdan does not optimize the student into constant work. Recovery, unavailable time and realistic capacity are first-class constraints.

---

## Phase 13 — Personal explanation and accessibility layer

**Task:** P1-019.  
**Priority:** P1/P2.

### Goal

Learn how the student understands best without building a manipulative profile.

### Preferences and evidence

- explanation language;
- preserved original terminology;
- preferred order: example, definition, rule or diagram;
- comfortable Hebrew level;
- preferred session length;
- response format for ADHD, dyslexia or visual load;
- common error patterns;
- explicit user corrections to AI explanations.

### Experience

> Explain it the way that works for me.

Preferences remain editable, exportable and removable.

---

## Phase 14 — Accounts, sync, sharing and integrations

**Priority:** after personal-product retention.

### Reliability

- authentication;
- cloud database and object storage;
- multi-device sync;
- offline cache;
- conflict handling;
- automatic backup;
- background OCR/transcription jobs;
- full export and deletion.

### Sharing without a social network

- read-only note, deck, quiz or course pack;
- provenance-preserving import;
- selected-note collaboration;
- lecturer source packs;
- comments and suggestions;
- revocation and permissions.

### Integrations

- Google Drive;
- Google Calendar;
- Moodle/LMS where permitted;
- email attachment intake;
- mobile share sheet;
- browser extension;
- API and webhooks later.

### Explicit non-goals

- public social feed;
- follower counts;
- engagement farming;
- marketplace before copyright, moderation and trust are solved.

---

## Phase 15 — Production product and monetization

**Priority:** after retention and measured value.

### Product readiness

- onboarding;
- examples and help;
- accessibility audit;
- performance budgets;
- security and privacy review;
- error monitoring;
- copyright and academic-integrity policy;
- AI/OCR cost controls;
- abuse prevention;
- support workflow.

### Possible plans

- Free: limited storage, OCR pages and transformations.
- Student: larger library, transcription and Exam Engine.
- Pro: heavy use, large courses, export and advanced intelligence.
- Institutional pilot: accessibility or managed cohorts only after the personal product works.

---

# 7. Design direction

## Academic depth, not decorative clutter

The interface may use:

- layered panels;
- subtle pseudo-3D depth;
- restrained shadows;
- meaningful motion;
- course atmospheres through color and typography;
- knowledge maps and source relationships;
- focused single-task study mode.

It must not use visual complexity that hides content or breaks mobile use.

## Major visual surfaces

### Study Cockpit

One task, source context, answer area, bounded time and progress through the current session.

### Knowledge Landscape

A concept graph where state reflects evidence and each node opens the action that improves it.

### Exam Readiness

A multidimensional view of coverage, recall, application and practice rather than unexplained percentage theater.

### Course Workspace

A coherent course environment with source stacks, topics, outputs, assessments and next actions.

---

# 8. Measurement plan

## North-star outcome

> How many approved sources become reused study outputs and completed evidence-backed study actions?

## 30% burden-reduction target

Measure during the one-course pilot and later cohorts:

- time to organize a syllabus and course;
- time from source upload to usable Study Pack;
- time spent searching old materials;
- time spent creating cards and tests;
- time spent deciding what to study;
- repeated manual context entry;
- missed deadlines and emergency cram sessions;
- task completion with and without Lamdan.

## Guardrails

- unsupported-claim rate;
- broken source-link rate;
- OCR correction burden;
- data-loss incidents;
- recommendation acceptance and usefulness;
- mobile completion rate;
- user ability to explain why a recommendation appeared.

Time spent inside Lamdan is not a success metric by itself.

---

# 9. Priority map

## Now

1. Keep shell, persistence, source integrity and CI stable.
2. Run private live OCR validation (`P1-006`).
3. Run live golden quiz validation (`P1-007`).
4. Complete the one-course pilot (`P1-008`).
5. Deepen multi-page E2E (`P1-009`).
6. Ship and validate Study Command Center v1 (`P1-011`).

## Next

1. Lecture-to-Study-Pack (`P1-012`).
2. Concepts and evidence model (`P1-013`).
3. Exam Engine (`P1-014`).
4. Assignment Copilot (`P1-015`).
5. Audio transcription and Lecture Mode (`P1-010`, `P1-016`).
6. Ask My Course (`P1-017`).
7. Workload forecast (`P1-018`).
8. Personal explanation layer (`P1-019`).

## Later

1. Accounts and cloud sync.
2. Sharing and collaboration.
3. Drive, Calendar, email and LMS integrations.
4. Paid plans and institutional pilots.

## Explicitly deferred

- streaks as product identity;
- generic productivity scoring;
- focus timer as a primary screen;
- social network;
- public marketplace;
- native apps before responsive web stability;
- broad institutional LMS administration.

---

# 10. Immediate implementation sequence

Completed technical foundation:

1. CI and permanent contracts.
2. Content-first shell.
3. Universal document and photo intake.
4. Material Workspace and editable source chunks.
5. Grounded AI drafts.
6. Syllabus and Course Workspace v1.
7. Notes, Flashcard Studio and Quiz Studio.
8. OCR preprocessing, overlays, multi-page sources and full backup.
9. Global search, browser E2E and store/source safety.

Active product sequence:

10. Validate live OCR and golden quizzes on private/licensed real material.
11. Complete one-course closed pilot.
12. Validate Study Command Center ranking and mobile usability.
13. Build a unified Lecture-to-Study-Pack flow.
14. Add concept evidence and mistake taxonomy.
15. Build Exam Engine on top of real evidence.
16. Add Assignment Copilot.
17. Add audio transcription and Lecture Mode.
18. Add course Q&A, workload forecast and personal explanation preferences.

M1 is reached when one real Israeli course completes the existing source-to-output pilot without critical trust or data-loss failures.

M2 — Academic Autopilot is reached when the same student can use Lamdan for four consecutive weeks and the product reliably chooses useful next actions, produces Study Packs and reduces measured study-management burden.
