# Exam planning v1

## Outcome

A student can save a course preparation profile, weight current course topics from 1 to 5 and generate a daily schedule before an exam.

This feature does not predict a grade, pass probability or readiness. It only allocates the time and weekdays entered by the student.

## Stored profile

- course and exam date;
- daily minute budget;
- maximum study-block length;
- available weekdays;
- explicit topic weights.

Planning data uses `lamdan.exam-planning.v1`. Frozen sessions stay in `lamdan.exam-engine.v1` and are not modified by planning changes.

## Allocation rules

- only dates before the exam are scheduled;
- the horizon is capped at the final 180 days;
- unavailable weekdays receive no tasks;
- each day stays within the daily budget;
- each task stays within the session limit;
- total topic time follows the entered weights;
- equal inputs produce the same plan.

## UI and validation

The Exam Engine page shows a separate planning panel before the frozen blueprint workflow. Permanent checks cover invalid profiles, horizon capping, weekday filtering, minute limits, weighted allocation, determinism, persistence and coexistence with a submitted frozen exam.
