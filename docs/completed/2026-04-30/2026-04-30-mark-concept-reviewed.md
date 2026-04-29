# Mark Concept Reviewed

Date: 2026-04-30

App affected: educoach

Type of work: feature, fix, backend

## Summary

Implemented explicit per-concept review completion on web. Learning path review links now carry the tapped concept into the document Concepts tab, and the tab exposes a Mark Reviewed action for that specific concept.

## Problem Being Solved

The web app had concept review cards that could route to the document, but there was no durable way to complete a manually reviewed concept. Due Today state depended on `user_concept_mastery.due_date`, so the UI needed a real one-concept schedule update.

## Scope of Changes

- Added a web `useMarkConceptReviewed` mutation.
- Passed `concept` query params from learning path review routes.
- Passed the focused concept id from `FileViewer` into `ConceptsTab`.
- Added a per-concept Mark Reviewed action in the Concepts tab.
- Kept concept rows keyboard-accessible after adding the nested action button.

## Files/Modules/Screens/Components/Services Affected

- `src/hooks/useLearning.ts`
- `src/components/files/FileViewer.tsx`
- `src/components/files/ConceptsTab.tsx`
- `src/components/learning-path/LearningPathContent.tsx`
- `src/components/learning-path/LearningPathCalendar.tsx`
- `scripts/mark_concept_reviewed_contract_test.py`

## Supabase Impact

- Schema changes: none.
- Policy changes: none.
- Auth changes: none.
- Storage changes: none.
- API/query changes: updates the existing `user_concept_mastery` row by `user_id` and `concept_id`.
- Updated fields: `last_reviewed_at`, `due_date`, `interval_days`, `repetition`, `ease_factor`, `confidence`, and `priority_score`.

## User-Facing Behavior Changes

- Concept review cards open `/files/:id?tab=concepts&concept=:conceptId`.
- The focused concept is highlighted in the Concepts tab.
- Mark Reviewed completes only the focused or due concept.
- Learning path counts refresh after the review is marked.

## Developer Notes Or Architectural Decisions

- Manual concept review uses SM-2 quality `4` as a successful self-review.
- The mutation advances schedule and priority but does not rewrite quiz-derived mastery.
- The Concepts tab uses a keyboard-accessible row wrapper so the Mark Reviewed button is not nested inside another button.

## Testing/Verification Performed

- `python3 scripts/mark_concept_reviewed_contract_test.py` passed.
- `npx tsc --noEmit` passed.

## Known Limitations

- Manual review completion is a self-reported review signal, not a graded assessment.
- No Supabase event log is added for manual review history in this change.

## Follow-Up Tasks Or Recommended Next Steps

- Consider adding review history analytics for manual concept reviews.
- Consider adding a short confirmation state on the concept card after mutation success.

