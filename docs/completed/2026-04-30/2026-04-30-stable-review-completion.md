# Stable Review Completion

Date: 2026-04-30

App affected: both

Type of work: fix

## Summary

Updated review completion behavior so reviewing one concept or flashcard no longer causes the Learning Path to behave like the whole day was replanned. Reviewed-today concepts are treated as complete for today, while unrelated due-today work remains visible.

## Problem Being Solved

Flashcard `Good` / `Easy` ratings and concept `Mark Reviewed` actions advanced mastery due dates and invalidated planner data in a way that could make today’s activities disappear or move unexpectedly. The toast also always said the concept was “scheduled for later” without showing the actual next review date.

## Scope Of Changes

- Added Learning Path planner handling for `last_reviewed_at`.
- Suppressed only today’s single-concept task/review for a concept reviewed today.
- Preserved unrelated due-today concepts and tasks.
- Stopped concept `Mark Reviewed` from invalidating adaptive-study tasks as a full replan.
- Stopped the flashcard study session exit path from forcing adaptive-task invalidation.
- Updated concept review toast copy to include the next review date.
- Added a regression test for reviewed-today completion behavior.

## Files/Modules/Screens/Components/Services Affected

- `src/lib/learningPathPlan.ts`
- `src/lib/learningPathPlan.test.ts`
- `src/hooks/useLearning.ts`
- `src/components/files/ConceptsTab.tsx`
- `src/components/files/FlashcardsTab.tsx`

## Supabase Impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: client cache invalidation changed for ordinary review completion; mastery and flashcard writes still update the same Supabase tables.

## User-Facing Behavior Changes

- Marking a concept reviewed removes that concept’s today work without wiping unrelated today activities.
- Flashcard review completion no longer forces the Learning Path to fully refetch adaptive tasks.
- The concept review toast now reports the next review date instead of always saying “scheduled for later.”

## Developer Notes Or Architectural Decisions

Review completion is now treated differently from explicit replanning. Quiz completion, document changes, manual task moves, and goal-window replans can still refresh adaptive tasks. Ordinary concept/flashcard review only refreshes learning/mastery data.

## Testing/Verification Performed

- `npm test -- src/lib/learningPathPlan.test.ts` passed with 14 tests.
- `npm run build` completed successfully.

## Known Limitations

The web regression test covers the shared planner behavior. Mobile has no equivalent test runner configured in `package.json`, so mobile parity was verified through TypeScript source alignment and the shared planner change.

## Follow-Up Tasks Or Recommended Next Steps

- Add a mobile test harness for shared planner utilities.
- Consider showing a small “completed today” state instead of fully hiding reviewed concepts if students need an audit trail of finished tasks.

