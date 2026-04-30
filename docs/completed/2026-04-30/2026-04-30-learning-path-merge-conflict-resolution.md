# Learning Path Merge Conflict Resolution

Date: 2026-04-30

App affected: educoach

Type of work: fix

## Summary of what was implemented

Resolved merge conflicts from `origin/Jhon` in the learning path calendar and content components while retaining both branches' adaptive quiz behavior.

## Problem being solved

The merge stopped on content conflicts in:

- `src/components/learning-path/LearningPathCalendar.tsx`
- `src/components/learning-path/LearningPathContent.tsx`

Both sides changed adaptive quiz actions. One side added shared quiz-action handling for due-today adaptive quiz cards, while the other side added safeguards for manual adaptive tasks so they force a new quiz and bind generated quizzes back to the source adaptive task.

## Scope of changes

- Combined the shared adaptive quiz action handler with manual-task generation safeguards.
- Preserved reusable ready quiz routing for normal adaptive tasks.
- Preserved force-new quiz generation for manual adaptive tasks.
- Preserved source adaptive task binding through `sourceTaskId`.
- Removed merge-introduced unused imports and an unused computed goal-card block that prevented TypeScript compilation.

## Files/modules/screens/components/services affected

- `src/components/learning-path/LearningPathCalendar.tsx`
- `src/components/learning-path/LearningPathContent.tsx`
- `src/components/learning-path/LearningPathSelector.tsx`
- `docs/completed/2026-04-30/2026-04-30-learning-path-merge-conflict-resolution.md`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

The fix uses the existing `useGenerateReviewQuiz` options already present in the codebase: `forceNew` and `sourceTaskId`.

## User-facing behavior changes

- Clicking adaptive quiz tasks still routes to an existing usable quiz when one can be reused.
- Manual adaptive quiz tasks now continue to request a fresh quiz instead of accidentally reusing an older ready quiz.
- Generated adaptive quizzes remain connected to their source task when a task id is available.

## Developer notes or architectural decisions

The duplicate conflict blocks were resolved by moving branch-specific behavior into the shared adaptive quiz handler instead of keeping separate generation paths. This keeps calendar task clicks and due-today quiz clicks consistent.

## Testing/verification performed

- Confirmed no merge conflict markers remain in the resolved learning path files.
- Ran `npm run build`.
- Build completed successfully.

## Known limitations

- The production build still reports the existing Vite large chunk warning for the main bundle.

## Follow-up tasks or recommended next steps

- Review whether the large bundle warning should be addressed with route-level or feature-level code splitting.
