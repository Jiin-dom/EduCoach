# Quiz Deadline Learning Path Fix

- Date: 2026-04-19
- App affected: both
- Type of work: fix

## Summary of what was implemented

Quiz deadlines in the learning path now resolve per quiz instead of being copied from the parent document onto every quiz for that document. The web app was updated to write deadline changes to `quizzes.deadline`, preserve `documents.deadline` only as a legacy summary/fallback value, and render calendar/due-today goal markers from the effective per-quiz deadline.

## Problem being solved

When a user generated or edited a quiz deadline, the learning path calendar treated `documents.deadline` as if it belonged to every quiz under that document. That caused older quizzes and even completed quizzes to appear moved to the newest deadline.

## Scope of changes

- Added shared quiz deadline resolution helpers for the web learning-path flow.
- Updated quiz generation and quiz deadline editing to save to `quizzes.deadline`.
- Recomputed document-level deadline summary from actual quiz deadlines instead of using it as the source of truth.
- Updated learning-path planning, goal management, and due-today views to use per-quiz effective deadlines.
- Added a regression test covering the deadline fan-out bug and the legacy fallback behavior.

## Files/modules/screens/components/services affected

- `educoach/src/lib/quizDeadlines.ts`
- `educoach/src/lib/learningPathPlan.ts`
- `educoach/src/lib/learningPathPlan.test.ts`
- `educoach/src/hooks/useQuizzes.ts`
- `educoach/src/pages/LearningPathPage.tsx`
- `educoach/src/components/learning-path/StudyGoalsPanel.tsx`
- `educoach/src/components/learning-path/ExamManager.tsx`
- Related mobile counterpart updated in `educoach-mobile`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes:
  - Reused existing `quizzes.deadline` column as the source of truth for quiz deadlines.
  - `documents.deadline` is now treated as a summary/legacy fallback for the latest quiz only when no explicit quiz deadlines exist for the document.

## User-facing behavior changes

- Setting a deadline for a new quiz no longer moves older quizzes to the same date.
- Completed quizzes no longer inherit the latest quiz deadline just because they share a document.
- Learning path calendar markers and due-today quiz rows now reflect the correct quiz-specific deadline.

## Developer notes or architectural decisions

- Introduced `getEffectiveQuizDeadline()` so every caller uses the same resolution rule.
- Legacy compatibility is preserved by allowing a document-level fallback only for the newest quiz in a document and only when that document has no explicit quiz deadlines stored yet.
- This keeps older data visible without letting legacy document deadlines fan out across all quizzes.

## Testing/verification performed

- Added regression coverage in `src/lib/learningPathPlan.test.ts` for:
  - explicit quiz deadline scoping
  - legacy fallback behavior
  - prevention of duplicate/fanned-out deadline markers
- Focused web regression test was run successfully earlier in this work session.
- A fresh end-of-task stdout-captured rerun was blocked by the current shell/Windows interop behavior in this environment.
- A previous web build check in this work session surfaced unrelated pre-existing build issues outside this fix.

## Known limitations

- Fresh terminal-captured verification at the end of the task was limited by the local Node/WSL/Windows shell environment.
- Existing unrelated web build issues still need cleanup in files outside this fix path.

## Follow-up tasks or recommended next steps

- Run the mobile learning-path flow manually:
  - generate a quiz with a deadline
  - confirm only that quiz gets the marker
  - confirm older/completed quizzes keep their original/no deadline state
- Clean up the unrelated web build errors so full project build verification can be restored.
