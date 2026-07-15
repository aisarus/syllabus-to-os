# Lamdan — One-course closed pilot

**Task:** P1-008  
**Status:** blocked until P1-006 live OCR and P1-007 live golden quiz validation pass.

This document is both the execution checklist and the durable record of evidence. Use one real Israeli course and do not replace failures with demo data.

## Pilot identity

- Course:
- Institution:
- Pilot date:
- Browser/device:
- App commit:
- AI model and prompt versions:
- Source-pack permission/provenance:

## Before starting

- [ ] Full ZIP backup of any existing Lamdan workspace downloaded.
- [ ] Empty local workspace confirmed.
- [ ] Desktop viewport checked.
- [ ] Mobile-width viewport checked.
- [ ] AI status shows the expected connected provider.
- [ ] Private assets are outside git.

## End-to-end script

### 1. Syllabus → course

- [ ] Import a real digital or reviewed photographed syllabus.
- [ ] Correct title, code, credits, semester and instructor.
- [ ] Review topics/weeks, readings, assessments and grading.
- [ ] Confirm exactly one course is created.
- [ ] Reimport and confirm no duplicate course/topics.

Evidence / failures:

### 2. Course pack intake

- [ ] Upload at least one PDF/DOCX.
- [ ] Upload one single photo.
- [ ] Create one multi-page photo material.
- [ ] Include Hebrew plus at least one mixed RTL/LTR source.
- [ ] Confirm one failed/unsupported file does not stop the queue.
- [ ] Confirm exact duplicate warning.

Evidence / failures:

### 3. OCR review

- [ ] Prepare one image with crop/rotation/contrast.
- [ ] Run OCR on printed Hebrew.
- [ ] Run OCR on handwriting or mathematics.
- [ ] Verify uncertain tokens and normalized mathematics.
- [ ] Apply only after manual review.
- [ ] Re-run OCR on one page after outputs already cite its chunks.
- [ ] Confirm those outputs still open valid source chunks.

Evidence / failures:

### 4. Study outputs

- [ ] Generate and edit one note.
- [ ] Generate and curate at least 20 flashcards.
- [ ] Generate and review one golden quiz.
- [ ] Confirm every supported claim/question has valid source links.
- [ ] Confirm unsupported content is warned or rejected.

Evidence / failures:

### 5. Persistence and recovery

- [ ] Reload the browser and continue editing.
- [ ] Confirm no false `Saved` state.
- [ ] Reorder multi-page images and confirm source links survive.
- [ ] Download a full ZIP.
- [ ] Clear all data.
- [ ] Restore the ZIP and verify text, images, OCR drafts and citations.

Evidence / failures:

### 6. Retrieval and exam preparation

- [ ] Search for a Hebrew term with and without niqqud.
- [ ] Search for content located on a flashcard back and quiz explanation.
- [ ] Open the exact material/note/quiz result.
- [ ] Prepare a small exam pack from reviewed sources.

Evidence / failures:

## Metrics

| Metric                         | Result |
| ------------------------------ | ------ |
| Failed uploads                 |        |
| Incorrect classifications      |        |
| Manual OCR corrections         |        |
| Invented/unsupported AI claims |        |
| Broken source links            |        |
| Save/persistence failures      |        |
| Repeated or confusing steps    |        |
| Desktop blockers               |        |
| Mobile blockers                |        |
| Total time to usable course    |        |

## Findings

### Critical blockers

### High-friction steps

### OCR failure categories

### Quiz-quality failure categories

### Mobile failures

### Fixes completed during pilot

## M1 decision

- [ ] Complete workflow finished without developer intervention.
- [ ] No approved data lost after reload or restore.
- [ ] No dangling source references remain.
- [ ] All critical blockers fixed.
- [ ] M1 — Useful personal tool may be marked achieved.

Decision and rationale:
