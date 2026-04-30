# Learning Path Completed Quizzes Prop Fix

Date: 2026-04-30

App affected: educoach

Type of work: fix

## Summary

Fixed a runtime crash in the web learning path calendar by wiring the already-computed `completedTodayQuizzes` list from `LearningPathPage` into `LearningPathCalendar`.

## Problem Being Solved

The learning path schedule could throw `ReferenceError: completedTodayQuizzes is not defined` because `LearningPathCalendar` rendered `completedTodayQuizzes` without declaring it as a prop or receiving it from the parent page.

## Scope of Changes

- Added `completedTodayQuizzes` to the `LearningPathCalendar` prop contract.
- Defaulted the prop to an empty array so the calendar remains safe when no completed quizzes are provided.
- Passed the parent page's computed completed-today quiz list into the calendar.
- Added a focused contract test for the parent-to-calendar completed quiz wiring.

## Files/Modules/Screens/Components/Services Affected

- `src/pages/LearningPathPage.tsx`
- `src/components/learning-path/LearningPathCalendar.tsx`
- `src/components/learning-path/LearningPathCalendar.contract.test.ts`

## Supabase Impact

- Schema changes: none.
- Policy changes: none.
- Auth changes: none.
- Storage changes: none.
- API/query changes: none.

## User-Facing Behavior Changes

- The learning path schedule view no longer crashes when it reaches the due/completed-today quizzes section.
- Completed quizzes for the current day can render in the calendar's completed-today section.

## Developer Notes Or Architectural Decisions

- The fix keeps the existing data ownership in `LearningPathPage`, where completed-today quizzes are already derived from attempts, quizzes, documents, and the active scope filter.
- `LearningPathCalendar` now receives the completed list the same way it receives due-today quizzes.
- This is web-only. No React Native code or shared Supabase behavior changed.

## Testing/Verification Performed

- `npm test -- src/components/learning-path/LearningPathCalendar.contract.test.ts`
- `npm run build`

## Known Limitations

- The new test is a source-level contract test. It guards this wiring bug directly, but it is not a full browser rendering test.

## Follow-Up Tasks Or Recommended Next Steps

- Consider adding a component-level render test setup for learning path UI sections if the project later adopts React Testing Library.
