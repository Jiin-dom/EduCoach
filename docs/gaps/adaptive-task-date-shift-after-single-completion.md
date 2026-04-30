# Adaptive Task Date Shift After Single Completion

## Purpose

Document the current learning-path behavior where completing one adaptive action can move other same-day adaptive tasks, explain why it happens, and define a solution.

## Trigger

The flow begins when the learner performs any one of these actions for a document:

- completes a quiz attempt
- reviews a flashcard
- marks a concept as reviewed

## Current Behavior (Observed)

If a learner has multiple adaptive tasks plotted on the same day for the same document (for example: quiz, flashcards, review), completing only one of them can cause the other tasks to move to another date.

### Example

- Day N has 3 adaptive tasks: quiz, flashcards, review.
- Learner opens review, marks concept as reviewed.
- Quiz and flashcards move from Day N to Day N+X.

## Why This Happens

The movement is a side effect of how adaptive scheduling is currently modeled.

1. **Any mastery update retriggers adaptive sync**
   - `useMarkConceptReviewed`, quiz-result processing, and flashcard review update `user_concept_mastery`.
   - DB trigger `trg_sync_adaptive_tasks_from_mastery` calls `sync_adaptive_study_tasks_for_document(...)`.

2. **Adaptive tasks are document-level and share one computed schedule**
   - In `sync_adaptive_study_tasks_for_document`, quiz/flashcards/review all receive the same computed base values (`reason`, `scheduled_date`, concept set, priority seed), then are upserted.
   - This means task types are not independently anchored by completion state.

3. **Completion changes the concept pool and due-date signals**
   - Marking reviewed advances concept `due_date` (SM-2).
   - Quiz/flashcard completion recomputes mastery and can also change `due_date`, confidence, and priority.
   - Sync recomputes urgency based on updated concept rows (including earliest due concept and study-day alignment), so the shared scheduled date can change.

4. **Result**
   - Remaining same-day tasks can move even though the learner only completed one task type.

## Product Gap

The learner expectation is usually:

- completing one adaptive task should update mastery,
- but should not unexpectedly reschedule other same-day planned tasks for that document.

The current behavior violates schedule stability and can feel like tasks are "disappearing" or "jumping."

## Expected Behavior (Target)

When one adaptive task type is completed:

- that completed task can advance/archive/update as needed,
- remaining same-day tasks should remain on the day unless there is a strong explicit reason to move them,
- the UI should feel stable within the current day.

## When Learning Path Should Adapt (With Fix)

With same-day stability in place, adaptation timing should be:

- **Immediately after mastery-changing events**:
  - quiz completion
  - flashcard review
  - mark concept as reviewed
- **Same-day scope**: keep remaining tasks anchored to today (no unexpected sibling task jumps).
- **Future-day scope**: allow normal adaptive recompute for upcoming days (reprioritize and move future tasks as needed).
- **User override scope**: if task has `user_scheduled_date`, user-selected date remains the source of truth.
- **Hard rule scope**: immediate change is still allowed for explicit lifecycle rules (for example, archive when no concept set remains).

## Solution Options

### Option A (Recommended): Per-task-type schedule anchoring with same-day stability

1. Add a "same-day freeze" rule in adaptive sync:
   - if an existing task is scheduled for app-today and is not user-rescheduled, keep it on today during same-day recompute.
2. Compute schedule independently per task type (quiz, flashcards, review) rather than blindly reusing one shared computed date.
3. Keep current `user_scheduled_date` override behavior, but add system-level guardrails to avoid unnecessary same-day drift.

**Pros**
- Lowest behavior surprise.
- Minimal UI changes required.
- Preserves adaptivity while improving trust.

**Cons**
- Slightly more complex sync logic.

### Option B: Lock remaining same-day tasks after first completion event

On first completion for a document/day, lock remaining tasks for that document/day until next day.

**Pros**
- Very predictable day plan.

**Cons**
- Less adaptive for late-day mastery improvements.
- Adds lock-state handling.

### Option C: Keep current logic but add explicit UX messaging

Do not change scheduling rules; show "Plan updated based on your latest performance" banners and event history.

**Pros**
- Fastest implementation.

**Cons**
- Does not solve the core surprise; only explains it.

## Recommended Implementation Direction

Adopt **Option A**.

Implementation implications:

- Update `sync_adaptive_study_tasks_for_document` to:
  - read existing task rows before upsert,
  - preserve `scheduled_date = app_today` for incomplete sibling tasks when recompute is triggered on the same day,
  - fall back to recalculated dates only when no same-day lock condition applies.
- Keep `user_scheduled_date` precedence as the highest override.
- Ensure this applies consistently for quiz-triggered, flashcard-triggered, and mark-reviewed-triggered sync paths.

## Acceptance Criteria

1. If quiz, flashcards, and review are all scheduled for today, and learner completes only review, the remaining quiz and flashcards stay today.
2. If learner completes a quiz today, remaining same-day flashcards/review stay today unless user manually reschedules.
3. If learner manually reschedules a task, `user_scheduled_date` still wins.
4. Tasks may still move on future days from adaptive recompute, but not unexpectedly within the same current day.
5. No regressions in adaptive task creation/archival when concept set becomes empty.

## Test Scenarios

- Scenario 1: same-day triplet (quiz/cards/review), complete review -> siblings remain today.
- Scenario 2: same-day triplet, complete quiz -> siblings remain today.
- Scenario 3: same-day triplet, complete flashcards -> siblings remain today.
- Scenario 4: one sibling manually rescheduled -> remains on user date after recompute.
- Scenario 5: no concepts remain -> tasks archive as expected.

