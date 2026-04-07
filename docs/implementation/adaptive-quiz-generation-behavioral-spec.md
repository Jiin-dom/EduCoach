# Adaptive Quiz Generation Behavioral Spec

## Purpose

This spec defines the expected behavior for adaptive review quiz generation in EduCoach.

It focuses on:
- what event starts adaptive quiz generation
- how adaptive quizzes should coexist with normal student-created quizzes
- what the system should do when a review quiz is already fresh, generating, stale, or missing
- what outcomes are considered correct

## Trigger

The flow begins when:

- the system detects weak, due, or developing concepts for a document after performance updates
- the Learning Path encounters a quiz task that still needs a focused review quiz
- the student explicitly starts an adaptive quiz from the Learning Path

## Expected Behavior

After the trigger, the system should determine whether a fresh adaptive review quiz already exists for the affected document and targeted concepts.

During an active flashcard, quiz, or review session, adaptive quiz generation intent can be computed immediately but should be applied to the visible Learning Path at a checkpoint (session completion or explicit exit) to avoid mid-session route churn.

This phase exists to:
- avoid creating duplicate review quizzes
- ensure the student gets a focused quiz tied to current weak areas
- preserve manual quiz generation as a separate user-controlled path
- avoid interrupting an in-progress assessment with immediate path/task rewrites

The system should then resolve into one of the following branches.

## Branches

### A. A fresh adaptive review quiz already exists

Condition:
- a review quiz for the document is already in `ready` state and is still fresh relative to the latest mastery-driving attempts

Expected system behavior:
- the system should reuse the existing review quiz
- the adaptive quiz task should point to that quiz through its linked quiz reference
- no duplicate review quiz should be generated for the same current weak-area state

Expected user-facing result:
- the student should be able to open the existing adaptive quiz immediately
- the student should not see duplicate review quizzes for the same adaptive need

### B. A review quiz is currently generating

Condition:
- a focused review quiz for the document already exists in `generating` state

Expected system behavior:
- the system should keep the adaptive quiz task in a generating state
- the system should reuse the existing generating quiz instead of starting another one
- the task should update to ready once quiz generation completes

Expected user-facing result:
- the student should see that the adaptive quiz is being prepared
- the student should be able to navigate to the quiz queue or wait state without creating duplicates

### C. No fresh adaptive review quiz exists

Condition:
- there is no existing generating quiz and no ready quiz that is still fresh for the current weak-area state

Expected system behavior:
- the system should generate a focused review quiz for the document
- the quiz should target the current high-priority weak, due, or developing concepts
- the resulting adaptive task should move from `pending_generation` to `generating`, then to `ready` when the quiz is available

Expected user-facing result:
- the student should receive a newly generated quiz aimed at the concepts they most need to work on
- the student should experience adaptive quiz creation as part of the Learning Path, not as a replacement for manual quiz creation

### D. No adaptive quiz is needed

Condition:
- there are no actionable concepts for the document

Expected system behavior:
- the system should not generate a review quiz
- the corresponding adaptive quiz task should be archived or remain absent from active views

Expected user-facing result:
- the student should not see a forced adaptive quiz when there is no clear weak-area target

## State Handling Requirements

The following state must be handled correctly:

- review quiz title or identity: distinguish adaptive review quizzes from normal manually generated quizzes
- quiz generation status: preserve `generating`, `ready`, and error handling through the quiz lifecycle
- adaptive task status: keep it aligned with whether a fresh review quiz is needed, generating, or ready
- latest mastery-driving activity timestamp: use it to decide whether an older ready review quiz is stale
- manual quiz creation flow: preserve it as a separate path that remains available to students at all times
- session checkpoint handling: defer adaptive-task projection updates while another assessment session is active, then apply once the session ends

## Completion Criteria

The flow is complete when:

- the student has either a reusable ready review quiz, a generating review quiz, or no adaptive quiz because none is needed
- the adaptive task correctly reflects that lifecycle state
- the student can still create normal quizzes independently
- active non-quiz assessment sessions are not interrupted by adaptive quiz task updates

The flow is not complete if:

- duplicate review quizzes are created for the same current adaptive need
- a stale review quiz is reused after mastery state has materially changed
- adaptive quiz generation blocks or replaces normal manual quiz generation
- adaptive quiz task recompute ejects the student from an active flashcard or review session

## Product-Facing Result

From a product point of view:

- adaptive quiz generation should behave like "EduCoach preparing the next focused quiz for weak areas"
- manual quiz creation should behave like "the student's independent study action"
- the two flows should not behave like "mutually exclusive quiz systems"

## Implementation Implication

The current implementation should treat adaptive quiz generation as a thin orchestration layer on top of normal quiz generation.

The implementation may need to change in the following way:

- detect whether a fresh or generating adaptive review quiz already exists before calling quiz generation
- keep adaptive quiz status synchronized with persisted adaptive study task rows

Important:
- adaptive review quizzes should be identifiable without blocking standard quizzes for the same document
- freshness checks should key off recent mastery-driving activity, not only quiz existence
- adaptive quiz projection should respect session checkpoints so active assessment UX stays stable

## Acceptance Criteria

This spec is satisfied if:

1. When actionable weak-area concepts exist and no fresh review quiz exists, the system generates a focused adaptive review quiz.
2. When a fresh adaptive review quiz already exists, the system reuses it instead of creating another one.
3. When an adaptive review quiz is already generating, the system does not start a duplicate generation request.
4. Students can still generate normal quizzes independently even when adaptive review quizzes exist.
5. The adaptive quiz task shown in the Learning Path matches the current quiz lifecycle state.
6. Adaptive quiz-task updates do not force-close an in-progress flashcard or review session.

## Open Questions

- Should adaptive review quizzes have stronger metadata than title-based identification alone?
- Should multiple adaptive review quizzes ever exist per document for different focus clusters, or should there only be one active review quiz at a time?
- Should stale adaptive quizzes be automatically hidden from quiz lists, or only deprioritized in the Learning Path?
