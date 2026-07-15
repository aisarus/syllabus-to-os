# Exam Engine v1

## Purpose

Exam Engine turns an existing reviewed quiz bank into a timed, frozen exam session. It does not generate questions at start time and it does not claim to predict a university grade.

## Source-grounded question bank

A blueprint can start only when:

- the course and quiz still exist;
- at least two selected questions still exist in that quiz;
- every selected question has a valid correct option;
- every selected question links to at least one current approved source chunk.

The blueprint preview shows question count, distinct source coverage and linked concept coverage. Narrow repeated-source coverage is a warning, not a hidden score adjustment.

## Frozen session

At start time Lamdan copies and shuffles:

- question ids and prompts;
- answer options;
- correct indexes;
- explanations;
- source chunk ids;
- start and deadline timestamps.

Later edits to the quiz bank cannot rewrite the active or submitted session.

## Partial answers and timing

The session persists after every answer. Once the deadline passes, the exam submits as timed out. Manual submission is also available.

Unanswered questions remain explicitly unanswered. They reduce the raw score because the denominator is the full frozen exam, but they do not create invented question-level failure evidence.

## Results

The submitted result stores:

- raw score;
- correct, answered and unanswered counts;
- timeout state;
- immutable per-question result;
- the linked aggregate quiz-attempt id.

Correct answers and explanations appear only after submission.

## Question-level evidence

Answered questions are copied into `lamdan.quiz-attempt-details.v1` with mode `exam`, then published as one aggregate core quiz attempt. The existing concept lifecycle creates recognition success/failure evidence only for linked answered questions.

Questions left unanswered have no answer snapshot and create no concept-level outcome.

## No grade prediction

Exam Engine v1 reports only the result of the frozen session. It does not estimate course readiness, final grade, pass probability or mastery percentage.

## Current boundaries

- The question bank must already exist and pass source-link validation.
- Multiple-choice frozen sessions are implemented first.
- Open-answer exam sections and oral responses are follow-ups.
- Exam Engine v1 uses a companion local store, `lamdan.exam-engine.v1`; Workspace backup integration is a follow-up before M2.
- The direct route is `/app/exam-engine`; navigation integration follows after the first validated slice.
