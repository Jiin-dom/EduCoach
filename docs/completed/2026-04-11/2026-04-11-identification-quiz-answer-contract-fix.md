# Identification Quiz Answer Contract Fix

- Date: 2026-04-11
- App affected: both
- Type of work: fix

## Summary of what was implemented

Aligned quiz generation, validation, Gemini refinement, and grading so `identification` questions now behave as short-answer concept/topic lookups for newly generated quizzes. Newly generated identification questions store a concise term or phrase as `correct_answer` instead of a sentence or paragraph.

## Problem being solved

The quiz system mixed two incompatible behaviors:

- generation often stored sentence/paragraph answers for identification questions
- web and mobile rendered identification as a one-line short-answer input
- grading tried to compare short user answers against long stored definitions

That made correct term-only answers look wrong and caused the results screen to show paragraph-style "Correct answer" values for identification.

## Scope of changes

- Tightened the identification-answer contract in the NLP generator.
- Added a shared identification guardrail helper in the `generate-quiz` Edge Function.
- Updated Gemini fallback and enhancement prompts to preserve short-answer identification questions.
- Refactored web and mobile grading into shared per-app helpers with the same short-answer rules.
- Updated Phase 4 documentation to describe the actual contract now enforced.

## Files/modules/screens/components/services affected

- `educoach/nlp-service/main.py`
- `educoach/supabase/functions/generate-quiz/index.ts`
- `educoach/supabase/functions/generate-quiz/identificationContract.ts`
- `educoach/src/lib/quizAnswering.ts`
- `educoach/src/components/quizzes/QuizView.tsx`
- `educoach-mobile/src/lib/quizAnswering.ts`
- `educoach-mobile/src/screens/QuizScreen.tsx`
- `educoach/src/lib/quizAnswering.test.ts`
- `educoach/src/test/generateQuizIdentificationContract.test.ts`
- `educoach/src/test/nlpIdentificationContractSource.test.ts`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes:
  - `generate-quiz` now filters invalid long-form identification questions before saving
  - newly generated `quiz_questions.correct_answer` values for identification now represent short canonical terms/phrases

## User-facing behavior changes

- Newly generated identification questions expect a short concept/topic name only.
- Web and mobile grading now treat identification as short-answer matching instead of paragraph similarity matching.
- Results screens for newly generated quizzes show short identification answers instead of paragraph definitions.
- Existing previously generated quizzes are unchanged and may still show the old long-form behavior.

## Developer notes or architectural decisions

- No new question type was introduced. The fix keeps the existing four quiz question types and makes `identification` internally consistent.
- The Edge Function now has an explicit identification-contract helper so Gemini fallback/enhancement cannot silently reintroduce long-form answers.
- Web and mobile grading logic was extracted from screen components into dedicated helpers to keep parity across apps.

## Testing/verification performed

- Targeted Vitest coverage added for:
  - web grading helper
  - edge identification contract helper
  - NLP source contract assertions
- Verified the following targeted test run passes:
  - `npm test -- src/lib/quizAnswering.test.ts src/test/generateQuizIdentificationContract.test.ts src/test/nlpIdentificationContractSource.test.ts`

## Known limitations

- Existing quizzes are not backfilled or migrated.
- Mobile does not currently have a dedicated automated test runner in this repo, so parity is enforced through mirrored helper logic and manual review rather than a separate mobile unit-test suite.

## Follow-up tasks or recommended next steps

- Add a dedicated mobile test runner so shared grading helpers can be covered automatically on both apps.
- Consider a future separate long-form question type if definition/explanation prompts are needed as a distinct experience.
