# Learning Path Gap Fix

- Date: 2026-04-09
- App affected: educoach
- Type of work: feature, refactor, UI

## Summary of what was implemented

Completed the v1 gap fix for Learning Path viewing and editing by introducing a shared learning-path read model, surfacing baseline generated study work before quiz attempts exist, wiring the calendar replanning action, and making learning-path edits refresh all affected planner data.

## Problem being solved

The Learning Path page previously had two product gaps:

- generated study work was not fully visible before the student had meaningful attempt history
- “Edit Learning Path” was only partially real because key calendar scheduling controls were present but not fully wired

That made the page feel incomplete and caused the docs to overstate what was actually shipped.

## Scope of changes

- Added a shared learning-path plan model that combines planned reviews, adaptive tasks, file goals, and quiz deadlines.
- Reused that model in both the main Learning Path content and the calendar.
- Added a generated-plan section so baseline goal-window placeholders remain visible before attempts exist.
- Wired the calendar’s automatic reschedule action to shared replanning logic.
- Wired calendar quick actions to real destinations.
- Centralized goal-window replanning so Profile and Learning Path use the same flow and progress reporting.
- Expanded invalidation after goal and document updates so planner surfaces stay synchronized.
- Updated docs to reflect shipped behavior instead of roadmap language.

## Files/modules/screens/components/services affected

- `src/lib/learningPathPlan.ts`
- `src/lib/learningPathPlan.test.ts`
- `src/hooks/useLearningPathPlan.ts`
- `src/hooks/useGoalWindowScheduling.ts`
- `src/hooks/useDocuments.ts`
- `src/components/learning-path/LearningPathContent.tsx`
- `src/components/learning-path/LearningPathCalendar.tsx`
- `src/components/profile/ProfileContent.tsx`
- `docs/completed/feature-exam-dates.md`
- `docs/completed/feature-study-goals.md`
- `docs/info/learning_path_explained.md`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: no backend contract changes; frontend query invalidation was expanded so planner views refetch consistently after edits

## User-facing behavior changes

- Students now see generated baseline study items on the Learning Path even before they have quiz-attempt history.
- File goals and quiz deadlines are visible as explicit goal markers in the Learning Path plan and calendar.
- The calendar’s `Reschedule Automatically` action now works and shows progress/partial-success feedback.
- Profile saves and manual replanning now use the same shared replanning behavior as the calendar.
- Quick Actions in the calendar now navigate to quizzes and flashcards instead of doing nothing.
- Dragging a planned review to another day remains supported and now stays aligned with the shared planner model.

## Developer notes or architectural decisions

- This change is a read-model refactor, not a planner-schema redesign.
- Adaptive tasks remain derived outputs and are not manually editable in v1.
- The shared `useLearningPathPlan()` hook is the main integration point for visible planner state.
- Existing Supabase tables and goal-window scheduling logic were reused; only the front-end composition and invalidation behavior changed.

## Testing/verification performed

- Added `src/lib/learningPathPlan.test.ts` to cover the shared planner read model.
- Manually reviewed the refactor paths for:
  - baseline versus performance planned reviews
  - goal-marker generation
  - shared replanning usage in Profile and Learning Path
  - query invalidation after schedule-related edits
- Full automated test execution could not be completed in this environment because Node/npm tooling is not runnable in the current WSL setup.

## Known limitations

- Automated test execution is still blocked by the local environment, so the new test file was added but not run here.
- Adaptive tasks are still not manually reorderable or individually date-editable.
- This is still a v1 planner surface, not a full manual planning system.

## Follow-up tasks or recommended next steps

- Run the new and existing frontend tests in a working Node environment.
- Add component-level tests for the generated-plan section and calendar replanning states.
- Consider a dedicated planner explanation panel if users need more transparency on why an item appeared where it did.
