# Lamdan — One-course closed pilot

**Task:** P1-008  
**Status:** blocked until P1-006 live OCR and P1-007 live golden quiz validation pass.

This is an executable evidence harness, not a claim that the pilot has passed. Use one real Israeli course, keep private/licensed assets outside git, and do not replace failed live steps with demo data.

## 0. Create the pilot session

Start Lamdan from the exact commit being tested, then create an evidence directory **outside the repository**:

```bash
node scripts/run-pilot-preflight.mjs \
  --base-url http://127.0.0.1:3000 \
  --course "<course name>" \
  --institution "<institution>" \
  --evidence-dir ../lamdan-pilot-evidence/<session-id> \
  --commit "$(git rev-parse HEAD)" \
  --browser-device "<browser, version, viewport/device>" \
  --provenance "<permission and source-pack provenance>"
```

The command must create `00-preflight/pilot-session.json` containing the exact app commit, provider snapshots, evidence plan and external-gate state.

Set a live gate to ready only when the required licensed input is genuinely available:

```bash
export LAMDAN_PILOT_LIVE_OCR_READY=1
export LAMDAN_PILOT_GOLDEN_QUIZ_READY=1
export LAMDAN_PILOT_LICENSED_LECTURE_READY=1
```

Unset variables remain `blocked`. Do not mark P1-006, P1-007 or P1-008 complete from deterministic mocks.

## Required evidence format

For each numbered stage create the named `result.json` with:

```json
{
  "status": "pass | fail | blocked",
  "startedAt": "ISO timestamp",
  "finishedAt": "ISO timestamp",
  "expected": [],
  "observed": [],
  "evidence": [],
  "failures": [],
  "appCommit": "exact Git SHA"
}
```

Screenshots, exported JSON and recordings referenced by `evidence` stay in the external evidence directory. Never commit private course assets.

## Before starting

- [ ] Full ZIP backup of any existing Lamdan workspace downloaded.
- [ ] Empty local workspace confirmed.
- [ ] Desktop and mobile-width viewports recorded in `pilot-session.json`.
- [ ] AI and transcription provider snapshots reviewed.
- [ ] Source-pack permission/provenance recorded.
- [ ] Private assets confirmed outside git.
- [ ] Keyboard-only navigation reaches the skip link, mobile drawer and primary course actions.

## 1. Syllabus → course

- [ ] Import a real digital or reviewed photographed syllabus.
- [ ] Correct title, code, credits, semester and instructor.
- [ ] Review topics/weeks, readings, assessments and grading.
- [ ] Reimport the same syllabus.

**Expected result:** exactly one reviewed course; reimport creates no duplicate course or topics; uncertain fields remain reviewable rather than silently invented.  
**Evidence file:** `01-syllabus/result.json`.

## 2. Course pack intake

- [ ] Upload at least one PDF or DOCX.
- [ ] Upload one single photo and one multi-page photo material.
- [ ] Include Hebrew and one mixed RTL/LTR source.
- [ ] Include one unsupported or intentionally failed file.
- [ ] Upload an exact duplicate.

**Expected result:** one failed item does not stop the queue; duplicate warning is explicit; successful sources remain attached to the intended course.  
**Evidence file:** `02-intake/result.json`.

## 3. OCR review — P1-006 gate

- [ ] Confirm `externalGates.liveOcr` is `ready`; otherwise mark this stage `blocked`.
- [ ] Prepare one image with crop/rotation/contrast.
- [ ] Run OCR on printed Hebrew and on handwriting or mathematics.
- [ ] Review uncertainty and normalized mathematics before Apply.
- [ ] Re-run one cited page after outputs already reference its chunks.

**Expected result:** no source chunks change before Apply; cited outputs still open valid chunks after reviewed replacement; unreadable input abstains or requests review.  
**Evidence file:** `03-ocr/result.json`.

## 4. Study outputs — P1-007 quiz gate

- [ ] Generate and edit one note.
- [ ] Generate and curate at least 20 flashcards.
- [ ] Confirm `externalGates.goldenQuiz` is `ready`; otherwise mark the golden-quiz substep `blocked`.
- [ ] Generate and human-review one golden quiz.
- [ ] Inspect every claim/question source link.

**Expected result:** generated output remains draft until explicit Save/Apply; supported content opens exact evidence; unsupported or ambiguous content is warned, rejected or removed during review.  
**Evidence file:** `04-study-outputs/result.json`.

## 5. Persistence and recovery

- [ ] Reload and continue editing.
- [ ] Confirm a failed save never appears durable.
- [ ] Reorder multi-page images and verify source links.
- [ ] Download a full ZIP.
- [ ] Clear all data.
- [ ] Restore the ZIP.

**Expected result:** approved text, images, OCR drafts, quiz/flashcard data and citations survive reload and restore; no dangling source reference remains.  
**Evidence file:** `05-persistence/result.json`.

## 6. Retrieval and exam preparation

- [ ] Search a Hebrew term with and without niqqud.
- [ ] Search content on a flashcard back and in a quiz explanation.
- [ ] Open the exact material/note/quiz result.
- [ ] Prepare a small exam pack and complete one mistake-repair loop.

**Expected result:** search opens the correct entity and evidence; exam results remain frozen/reviewable; missed questions enter the repair flow without replacing the original result.  
**Evidence file:** `06-retrieval-exam/result.json`.

## Metrics

Write `metrics.json` with at least:

| Metric                         | Required value |
| ------------------------------ | -------------- |
| Failed uploads                 | count          |
| Incorrect classifications      | count          |
| Manual OCR corrections         | count/blocked  |
| Invented/unsupported AI claims | count          |
| Broken source links            | count          |
| Save/persistence failures      | count          |
| Repeated or confusing steps    | count          |
| Keyboard blockers              | count          |
| Desktop blockers               | count          |
| Mobile blockers                | count          |
| Total time to usable course    | duration       |

## Decision

Write `decision.md` with critical blockers, high-friction steps, OCR/quiz failure categories, fixes made during the run and a go/no-go rationale.

M1 may be marked achieved only when:

- [ ] the complete workflow finishes without developer intervention;
- [ ] no approved data is lost after reload or restore;
- [ ] no dangling source references remain;
- [ ] keyboard and mobile critical blockers are fixed;
- [ ] P1-006 and P1-007 have real licensed evidence;
- [ ] all critical blockers are fixed.

If any required live gate is blocked, the decision must remain **no-go / incomplete**, even when every deterministic stage passes.
