# Learning Path Replanning Behavioral Spec

## Purpose

This spec defines the expected behavior for Learning Path replanning in EduCoach.

It focuses on:
- what event should cause the Learning Path to change
- how the next study work should be recalculated
- what the student should experience as new performance data arrives
- what outcomes are considered correct

## Trigger

The flow begins when:

- a student uploads/processes a new document and EduCoach bootstraps a baseline plan
- the student completes a quiz
- the student reviews flashcards and changes concept review state
- the system updates concept mastery, confidence, due dates, or priority scores
- adaptive quiz generation changes the availability of a targeted review quiz

## Expected Behavior

After the trigger, the system should refresh the student's current learning priorities for the affected document and then expose the updated plan in the Learning Path.

This phase exists to:
- keep the study plan aligned with real performance rather than static assumptions
- provide an immediate, scheduled baseline plan before performance data exists
- turn new weak-area evidence into new study work
- remove or downgrade work that no longer matches the student's current needs

The system should then resolve into one of the following branches.

## Branches

### A. New or stronger weak areas are detected

Condition:
- new performance data lowers mastery, increases urgency, or surfaces overdue concepts

Expected system behavior:
- the system should increase the priority of the affected concepts
- the system should generate or refresh adaptive study tasks for quiz, flashcard, and review work
- the system should schedule those tasks onto the Learning Path using their updated dates and priority

Expected user-facing result:
- the student should see the new weak-area work appear in the Learning Path and calendar
- the most urgent or relevant work should move toward the top of the queue

### B. The student improves and the weak-area condition softens

Condition:
- new performance data increases mastery or clears overdue review pressure

Expected system behavior:
- the system should lower urgency for the affected concepts
- the system should update, replace, or archive adaptive tasks that are no longer the next best work
- the Learning Path should reflect the newer priority ordering

Expected user-facing result:
- the student should see older weak-area tasks disappear or become less prominent when they are no longer needed
- the plan should feel like it is adapting to progress rather than only accumulating tasks

### C. The student has no actionable weak-area work for a document

Condition:
- current mastery state does not justify targeted adaptive follow-up for that document

Expected system behavior:
- the system should stop presenting targeted adaptive tasks for that document
- the Learning Path should continue to show any remaining relevant learning items from other sources or documents

Expected user-facing result:
- the student should not see unnecessary review work for a document they are currently caught up on

## State Handling Requirements

The following state must be handled correctly:

- concept mastery state: set and preserve the latest mastery, confidence, due date, and priority values
- adaptive task state: update or archive tasks based on the newest concept state
- linked review quiz state: preserve or clear links depending on whether the current adaptive quiz is still fresh
- Learning Path query cache: refresh after mutations that affect mastery, flashcards, or quizzes
- scheduled task ordering: keep tasks sorted by due date, reason, and priority in a way the student can understand

## Completion Criteria

The flow is complete when:

- updated student performance produces a corresponding update in adaptive tasks
- the Learning Path and calendar render the latest adaptive state
- the student can act on the updated plan immediately

The flow is not complete if:

- the Learning Path still shows a stale plan after new quiz or flashcard data is recorded
- weak concepts change but the visible study queue does not
- the student is left with tasks that no longer match the latest mastery state

## Product-Facing Result

From a product point of view:

- the Learning Path should behave like "a live plan that responds to what the student just did"
- targeted study tasks should behave like "the next best actions to improve mastery"
- the plan should not behave like "a static checklist that ignores new performance data"

## Implementation Implication

The current implementation should separate mastery computation from plan presentation, while ensuring the plan is refreshed as soon as mastery-affecting actions complete.

The implementation may need to change in the following way:

- recompute adaptive task rows immediately after mastery-affecting events
- invalidate and refetch Learning Path task queries whenever relevant mutations succeed

Important:
- replanning should be incremental and document-aware rather than globally destructive
- the student should not need to manually refresh the app to see their updated plan

## Acceptance Criteria

This spec is satisfied if:

1. When a student completes a quiz or flashcard review that changes mastery, the Learning Path updates to reflect the new priorities.
2. When mastery worsens or review urgency rises, the Learning Path surfaces targeted adaptive work for the affected concepts.
3. When mastery improves enough that targeted work is no longer needed, stale adaptive tasks are removed from active views.
4. The student can open the updated adaptive tasks directly from the Learning Path and calendar.
5. The visible plan reflects current adaptive state without requiring a new login or manual reconstruction of tasks.

## Open Questions

- Should the Learning Path eventually merge adaptive tasks with goal-window scheduling into a single prioritized planner?
- Should replanning be immediate after every mastery-affecting event, or batched to reduce churn?
- Should the student be shown an explanation of why a task moved up, down, or disappeared from the Learning Path?
