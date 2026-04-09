# Learning Path Gap Fix Test Plan

- Date: 2026-04-09
- App affected: educoach
- Scope: View Generated Learning Path, Edit Learning Path, replanning, and calendar actions

## Setup

- Log in as a user with at least one uploaded document.
- Have one document with an `exam_date`.
- Have at least one quiz linked to a document.
- If possible, use one fresh document with no attempts and one older document with attempts.

## Test Cases

### 1. Generated Plan Appears Before Attempts

- Upload or process a new document.
- Set a file goal / `exam_date` for that document.
- Open `/learning-path`.
- Expected:
  - the page is not empty
  - a `Generated Plan` section appears
  - `Planned Baseline` items appear for concepts from that document
  - a `File Goal` marker appears for the document target date
  - the four mastery sections may still be empty if there are no attempts yet

### 2. Adaptive Tasks Still Show Separately

- Use a document that already has weak or developing concepts and adaptive tasks.
- Open `/learning-path`.
- Expected:
  - `Adaptive Study Queue` still appears as its own section
  - it coexists with the `Generated Plan` section
  - adaptive tasks still open the correct destination:
    - quiz task -> quiz or quizzes page
    - flashcards task -> flashcards tab
    - review task -> file concepts tab

### 3. Performance Sections Stay Attempt-Backed

- Use a document with quiz history.
- Open `/learning-path`.
- Expected:
  - `Due Today`, `Needs Review`, `Developing`, and `Mastered` only reflect attempt-backed concepts
  - baseline no-attempt placeholders do not appear in those four sections
  - baseline work stays in `Generated Plan`

### 4. File Goal Marker Visibility

- Set or edit a document `exam_date` in Goals & Planning.
- Return to `/learning-path`.
- Expected:
  - the `Generated Plan` section updates
  - the calendar shows a file-goal marker on the correct date
  - no manual page refresh is required

### 5. Quiz Deadline Marker Visibility

- Set or edit a quiz deadline in Goals & Planning.
- Return to `/learning-path`.
- Expected:
  - the `Generated Plan` section shows a `Quiz Deadline` marker
  - the calendar shows the quiz deadline on the correct day
  - clicking the quiz marker opens the correct quiz

### 6. Calendar Uses Shared Planner Data

- Open the Learning Path calendar in week view.
- Compare a date that has planned work or markers to the main page.
- Expected:
  - items shown in the calendar match the same plan state shown in the page
  - file goals, quiz deadlines, adaptive tasks, and planned reviews all appear on the correct dates

### 7. Drag Reschedule Planned Review

- In the calendar, drag a planned review to a different valid day.
- Drop it.
- Expected:
  - the due date changes
  - the item disappears from the old date and appears on the new one
  - the learning-path page remains consistent with the new date
  - no duplicate review appears on both dates

### 8. Drag Reschedule No-Op

- Drag a planned review onto the same date it already has.
- Expected:
  - nothing changes
  - no duplicate item appears
  - no broken UI state appears

### 9. Reschedule Automatically From Learning Path

- In the calendar sidebar, click `Reschedule Automatically`.
- Expected:
  - the button shows pending and progress state
  - progress text appears while replanning
  - on success, the schedule updates
  - if there are no goal-dated documents, a clear informational message appears instead of a silent no-op

### 10. Partial Replan Handling

- If you can simulate one bad goal-dated document and one good one, run automatic replanning.
- Expected:
  - the UI reports partial success rather than full failure
  - successful documents still update

### 11. Profile Save Replans Learning Path

- Go to Profile.
- Change available study days, study time window, or daily study minutes.
- Save.
- Expected:
  - profile saves successfully
  - replanning runs automatically if schedule fields changed
  - Learning Path reflects the updated schedule without manual refresh

### 12. Manual Replan From Profile

- In Profile, click `Replan Learning Path`.
- Expected:
  - the same progress behavior appears as the calendar action
  - the same success, partial-success, and no-goal messaging appears
  - Learning Path updates after completion

### 13. Quick Actions Are No Longer Dead

- In the Learning Path calendar sidebar:
  - click `View All Quizzes`
  - click `Practice Flashcards`
- Expected:
  - the first goes to `/quizzes`
  - the second goes to `/quizzes?tab=flashcards`
  - neither button is dead

### 14. Empty-State Behavior

- Use a user with no documents, no goals, and no attempts.
- Open `/learning-path`.
- Expected:
  - the empty state still shows
  - it prompts upload and quiz actions
  - no broken generated-plan placeholders appear without data

### 15. Quiz Completion Refreshes Planner

- Complete a quiz for a document already on the learning path.
- Return to `/learning-path`.
- Expected:
  - attempt-backed mastery sections update
  - adaptive tasks may change
  - some baseline items may move out of pure baseline visibility as real attempt data now exists
  - the page reflects fresh data without stale markers

## Watchouts

- duplicate items between `Generated Plan` and mastery sections
- goal markers showing the wrong date
- calendar and main page disagreeing about what is scheduled
- replan buttons spinning forever
- drag and drop updating the calendar but not the main page
- Quick Actions navigating nowhere
- errors when a user has zero goal-dated documents

## Pass Criteria

- Generated Plan is visible for goal-dated material before attempts exist.
- Learning Path and calendar stay consistent after edits.
- Manual replanning works from both Learning Path and Profile.
- Calendar Quick Actions navigate correctly.
- No stale or duplicate planner items appear after edits or quiz completion.
