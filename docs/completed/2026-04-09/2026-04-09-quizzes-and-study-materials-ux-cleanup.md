# Quizzes And Study Materials UX Cleanup

- Date: 2026-04-09
- App affected: educoach
- Type of work: fix, UI

## Summary of what was implemented

Removed the flashcards tab from the quizzes page, made the dashboard `Study Materials` card clickable, and added the dashboard quiz-generation tooltip so it matches the files page behavior.

## Problem being solved

The quizzes page was mixing two different study flows in one screen, and the dashboard `Study Materials` card required users to hunt for smaller controls instead of letting the whole card act as a clear navigation target. The dashboard quiz-generation icon also lacked the explanatory tooltip already used on the files page.

## Scope of changes

- Removed flashcards tab UI and flashcard-tab URL handling from the quizzes screen
- Updated learning-path flashcard shortcuts to open the document-level flashcards view instead of a removed quizzes tab
- Made the dashboard `Study Materials` card keyboard-accessible and clickable as a whole
- Added the `Generate quiz from this file` tooltip to the dashboard action icon
- Preserved existing quiz generation, file actions, and file-detail links inside the card

## Files/modules/screens/components/services affected

- `educoach/src/components/quizzes/QuizzesContent.tsx`
- `educoach/src/components/dashboard/DashboardContent.tsx`
- `educoach/src/components/learning-path/LearningPathContent.tsx`
- `educoach/src/components/learning-path/LearningPathCalendar.tsx`
- `educoach/docs/completed/2026-04-09/2026-04-09-quizzes-and-study-materials-ux-cleanup.md`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

- The quizzes page now shows only `Available` and `Completed` tabs
- Old flashcard shortcuts from learning-path views now open the relevant file’s flashcards tab
- Clicking the dashboard `Study Materials` card opens the files page
- The dashboard sparkle icon now shows `Generate quiz from this file` on hover/focus

## Developer notes or architectural decisions

- Flashcards were not removed from the product; they were redirected to the file-level study experience where they already exist
- Interactive controls inside the dashboard card explicitly stop event propagation so their own actions still win over the card-level navigation

## Testing/verification performed

- Searched the web app source for stale quiz flashcard-tab references after the change
- Ran the web app production build to confirm the updated UI compiles successfully

## Known limitations

- This session verified the changes by source inspection and successful build output, not by an interactive browser walkthrough

## Follow-up tasks or recommended next steps

- Open the dashboard and quizzes page in the browser to confirm the clickable card feels natural on desktop and mobile
- Check one learning-path flashcard task end-to-end to confirm it lands on the expected file flashcards tab
