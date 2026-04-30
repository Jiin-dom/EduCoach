# Flashcard Review Mastery Isolation

Date: 2026-04-30

App affected: both (`educoach` web implementation)

Type of work: fix

## Summary

Flashcard review ratings now update only the reviewed flashcard's SM-2 schedule. They no longer write flashcard answers into concept attempt logs, recompute concept mastery, or realign future learning-path due dates.

## Problem Being Solved

Selecting Easy, Good, or Hard during flashcard review was also being treated as concept mastery evidence. Easy and Good counted as correct evidence, which could promote concepts to mastered and push multiple learning-path activities into later dates after a flashcard session.

## Scope of Changes

- Kept flashcard review updates scoped to the `flashcards` table.
- Removed concept mastery recomputation from flashcard review.
- Removed adaptive learning-path invalidation from ordinary flashcard review completion.
- Removed the web flashcard study call site's adaptive invalidation flag.
- Added a regression contract test for the flashcard review behavior.

## Files/Modules/Screens/Components/Services Affected

- `src/hooks/useFlashcards.ts`
- `src/hooks/useFlashcards.contract.test.ts`
- `src/components/files/FlashcardsTab.tsx`

## Supabase Impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: flashcard review no longer inserts `question_attempt_log` rows and no longer updates `user_concept_mastery`

## User-Facing Behavior Changes

Completing a flashcard session schedules the reviewed cards for their next flashcard review, but it does not mark related concepts as mastered and does not move unrelated concept, quiz, or planned learning-path activities.

## Developer Notes Or Architectural Decisions

Flashcards are now card-level spaced repetition signals. Concept-level mastery remains driven by quiz attempts and explicit concept review actions, which better matches the expected mental model of "I reviewed this card" versus "I mastered this concept."

## Testing/Verification Performed

- Added and ran `npm test -- src/hooks/useFlashcards.contract.test.ts`

## Known Limitations

Existing `question_attempt_log` rows created by older flashcard sessions are not removed by this client change. If old rows already promoted a concept, a separate data repair or recalculation may be needed.

## Follow-Up Tasks Or Recommended Next Steps

Consider adding an admin or maintenance recalculation path that excludes historical flashcard-sourced attempt rows if existing users already have inflated concept mastery.
