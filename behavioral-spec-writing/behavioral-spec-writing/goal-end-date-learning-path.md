# Goal End-Date Learning Path Behavioral Spec

## Purpose

This spec defines expected behavior when a student sets a file goal end date (`documents.exam_date`) so EduCoach can plan study sessions up to that date and continuously adapt after quizzes.

It focuses on:
- what event starts the behavior
- what the system should do next
- what the user should experience
- what outcomes are considered correct

## Trigger

The flow begins when:

- the user sets, updates, or removes `documents.exam_date` for a specific document

## Expected Behavior

After `documents.exam_date` changes, the system should enter **goal-window scheduling** for that document.

This phase exists to:
- schedule document concept reviews inside the date window from today to the document goal date
- respect the student profiling availability (study days/time window/daily minutes)

The system should then resolve into one of the following branches.

## Branches

### A. Goal date is set in the future (per-document scheduling)

Condition:
- `documents.exam_date` is present and greater than today

Expected system behavior:
- Use a **per-document view** (not global earliest/latest across documents).
- Build a goal window for the selected document:
  - `windowStart = today (UTC date)`
  - `windowEnd = document.exam_date (date only)`
- Gather all concepts for that document.
- If any concept has no `user_concept_mastery` row, create a bootstrap placeholder row so scheduling can start immediately.
- Assign concept due dates inside available days within `[windowStart, windowEnd]`.
- Recompute `priority_score` after due date assignment.

Expected user-facing result:
- The schedule/calendar for that document shows topic sessions distributed across the available dates before the exam date.
- The learner can start following a plan even before first quiz attempts.

### B. Goal date is today or in the past

Condition:
- `documents.exam_date <= today`

Expected system behavior:
- Keep per-document mode.
- Treat all unscheduled concept work as immediately due (today).
- Preserve overdue behavior and decay-aware display.

Expected user-facing result:
- The plan clearly appears urgent (due today/overdue behavior is visible).

### C. Goal date is removed

Condition:
- `documents.exam_date` is set to `null`

Expected system behavior:
- Exit goal-window scheduling for that document.
- Keep concept mastery rows, but stop enforcing goal-window constraints for future scheduling.

Expected user-facing result:
- The document no longer shows an active exam-goal window in planning views.

## State Handling Requirements

The following state must be handled correctly:

- `documents.exam_date`: set, clear, preserve
- `user_concept_mastery` bootstrap placeholders:
  - create when concept exists but user has no mastery row yet
  - defaults:
    - `mastery_score = 50`
    - `confidence = 0`
    - `mastery_level = 'needs_review'`
    - `total_attempts = 0`
    - `correct_attempts = 0`
    - `repetition = 0`
    - `interval_days = 1`
    - `priority_score` computed with standard formula
  - tag as bootstrap (e.g., `is_bootstrap = true`) or infer via `total_attempts = 0`
- `user_concept_mastery.due_date`: scheduled within the document goal window
- `user_concept_mastery.priority_score`: recomputed after due date updates

## Completion Criteria

The flow is complete when:

- the document has a per-document schedule bounded by `[today, exam_date]`
- all document concepts are schedulable (including new concepts via placeholders)
- due dates and priority scores are saved successfully

The flow is not complete if:

- the system cannot schedule because no mastery rows exist and placeholders were not created
- due dates are outside the document goal window
- the UI shows stale or missing schedule after goal date changes

## Product-Facing Result

From a product point of view:

- setting a file goal date should behave like "Plan this specific document from now until exam day"
- multiple documents can have different active windows at the same time (independent per-document planning)
- the plan starts immediately, then adapts as soon as real quiz attempts are submitted

## Implementation Implication

The current implementation may need to change in the following way:

- add a per-document scheduler mutation that can bootstrap missing `user_concept_mastery` rows
- run scheduling after file goal date create/update
- keep existing adaptive recomputation (`recomputeConceptMastery`) as the authority once quiz data arrives

Important:
- do not block planning just because a student has not taken a first quiz yet
- once real attempts exist, adaptive updates should continuously override bootstrap assumptions

## Acceptance Criteria

This spec is satisfied if:

1. When a document goal date is set, the system generates a per-document schedule between today and that date.
2. If the document has concepts with no mastery rows, placeholder rows are created and scheduled.
3. After the student takes the first quiz, those placeholder assumptions are replaced by real mastery-driven updates.
4. Multiple documents with different `exam_date` values each keep their own independent schedule windows.
5. Removing a document goal date stops enforcing that document's goal-window scheduling.

## Open Questions

- Should bootstrap rows use explicit `is_bootstrap` flag in schema, or rely on `total_attempts = 0`?
- If daily capacity is insufficient for all concepts before exam date, should the system:
  - stack multiple sessions per day beyond preferred minutes, or
  - mark "capacity shortfall" and show a user warning?
