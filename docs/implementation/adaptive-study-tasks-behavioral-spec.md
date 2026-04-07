# Adaptive Study Tasks Behavioral Spec

## Purpose

This spec defines the expected behavior for persistent adaptive study tasks in EduCoach.

It focuses on:
- what events create or update adaptive study tasks
- how the system should translate mastery data into study work
- what the student should experience in the Learning Path
- what outcomes are considered correct

## Trigger

The flow begins when:

- a student's concept mastery changes after quiz processing
- a student's flashcard state changes in a way that affects due review work
- a review quiz is created, updated, completed, or becomes stale

## Expected Behavior

After one of these triggers, the system should record the latest learning state for the affected student and document.

Task projection in the Learning Path should follow a checkpoint model:
- while an assessment session is in progress, keep the visible adaptive task list stable
- when the session completes (or the user exits), apply the latest recompute result
- if no assessment session is active, recompute can apply immediately

This phase exists to:
- keep the Learning Path aligned with the student's latest performance
- persist adaptive work so it survives refreshes, sessions, and devices
- ensure the app can distinguish between work that is ready, generating, or no longer needed
- prevent mid-session task churn that interrupts the student's current assessment flow

The system should then resolve into one of the following branches.

## Branches

### A. Actionable weak or due concepts exist

Condition:
- the document has concepts that are due today, need review, or are still developing

Expected system behavior:
- the system should identify the highest-priority actionable concepts for that document
- the system should create or update persistent adaptive task rows for `quiz`, `flashcards`, and `review`
- each task should store the document, relevant concepts, reason, schedule date, priority, and any task-specific metadata
- the quiz task should reflect whether a focused review quiz is still needed, currently generating, or already ready

Expected user-facing result:
- the student should see adaptive study items in the Learning Path
- the student should see those tasks plotted on the Learning Path calendar using their scheduled date
- the student should be able to open the right surface directly from the task

### B. No actionable concepts remain

Condition:
- the document no longer has concepts that are due today, need review, or are developing enough to require targeted follow-up

Expected system behavior:
- the system should archive the adaptive tasks for that document instead of deleting them blindly
- archived tasks should stop appearing in active task queries
- ready or generating quiz references that are no longer relevant should no longer be presented as active adaptive work

Expected user-facing result:
- the student should stop seeing outdated adaptive study tasks for that document
- the Learning Path should reflect that the student has caught up on that document's targeted follow-up work

## State Handling Requirements

The following state must be handled correctly:

- `adaptive_study_tasks.status`: set to `pending_generation`, `generating`, `ready`, or `archived` based on current lifecycle state
- `adaptive_study_tasks.reason`: set to the highest-priority reason such as `due_today`, `needs_review`, or `developing`
- `adaptive_study_tasks.concept_ids`: preserve the currently targeted concepts for the task
- `adaptive_study_tasks.linked_quiz_id`: set when a review quiz exists for the task, clear when a fresh quiz is still needed
- `adaptive_study_tasks.scheduled_date`: set to the next relevant study date for the targeted work
- `adaptive_study_tasks.metadata`: store task-specific details such as question count or due flashcard count

Session stability requirements:
- Active flashcard, quiz, or review sessions should use a session snapshot so card/question order is not rewritten mid-session.
- Adaptive recompute during a session should be treated as pending projection changes, not immediate UI replacement.
- Recompute may archive or create tasks in persistence, but active session routing should not force-close the current session.

## Completion Criteria

The flow is complete when:

- the affected document has the correct active or archived adaptive task rows
- the task rows reflect the latest mastery and review state
- the Learning Path can load those rows and render the right task actions
- an in-progress assessment session is not interrupted by task recompute

The flow is not complete if:

- stale tasks remain active after the underlying weak-area condition is gone
- a new weak area exists but no adaptive task appears
- a task remains stuck in the wrong lifecycle status after the underlying state changed
- the student is exited from an active assessment session because adaptive tasks refreshed mid-session

## Product-Facing Result

From a product point of view:

- the Learning Path should behave like "a persistent adaptive study queue"
- adaptive tasks should behave like "the next best study actions based on current weak areas"
- outdated tasks should not behave like "permanent clutter from past mastery states"

## Implementation Implication

The current implementation should treat adaptive tasks as server-owned lifecycle records rather than purely derived client-side UI objects.

The implementation may need to change in the following way:

- recompute task state on the server whenever mastery, flashcards, or review quiz state changes
- query persisted task rows from the frontend instead of rebuilding the queue entirely from client joins

Important:
- task recomputation should be document-scoped so one document's changes do not rewrite unrelated adaptive work
- the frontend should defer adaptive-task query invalidation while an assessment session is active, and flush once the session ends

## Acceptance Criteria

This spec is satisfied if:

1. When quiz or flashcard performance changes concept mastery for a document, the system updates persisted adaptive tasks for that document.
2. When a document has weak or due concepts, the system exposes persistent adaptive `quiz`, `flashcards`, and `review` tasks for that document.
3. When a document no longer has actionable weak or due concepts, the previously active adaptive tasks are archived and stop appearing in the Learning Path.
4. The student is not left with stale adaptive tasks that no longer match current mastery state.
5. The final Learning Path and calendar views reflect the currently persisted adaptive task state after session checkpoint application.
6. While an assessment session is active, the student is not force-exited due to adaptive task recomputation.

## Open Questions

- Should a document always expose all three task types, or should some task types be suppressed when the underlying activity is not yet useful?
- Should archived adaptive tasks remain queryable for analytics or history views later?
- Should adaptive task generation eventually be throttled or batched when many concept updates happen in a short period?
