# Concept Review Button State

Date: 2026-04-30

App affected: both (`educoach` web implementation)

Type of work: UI fix

## Summary

The concept `Mark Reviewed` action now gives visible in-card feedback after it succeeds. The button changes to a green `Reviewed Today` state and becomes disabled for concepts already reviewed today.

## Problem Being Solved

Previously, marking a concept reviewed only showed a toast. The button still looked clickable and unchanged, which made it unclear whether the action had worked.

## Scope of Changes

- Added a small helper to detect whether `last_reviewed_at` falls on the current calendar date.
- Added local success state so the button updates immediately after the mutation succeeds.
- Updated the concept card review action to render a `Reviewed Today` visual state.

## Files/Modules/Screens/Components/Services Affected

- `src/components/files/ConceptsTab.tsx`
- `src/lib/conceptReviewState.ts`
- `src/lib/conceptReviewState.test.ts`

## Supabase Impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

The UI reads the existing `user_concept_mastery.last_reviewed_at` value and uses the existing `useMarkConceptReviewed` mutation result.

## User-Facing Behavior Changes

After a concept is marked reviewed, its button changes from `Mark Reviewed` to `Reviewed Today` with a green completed style. Concepts already reviewed today also render in that completed state when data is loaded.

## Developer Notes Or Architectural Decisions

The reviewed state is derived from both server data and local mutation success. This keeps the UI responsive while still staying consistent after query refetch.

## Testing/Verification Performed

- `npm test -- src/lib/conceptReviewState.test.ts`
- `npm run build`

## Known Limitations

The state is date-based and uses the existing ISO date string comparison style already used elsewhere in the app.

## Follow-Up Tasks Or Recommended Next Steps

Consider adding component-level UI tests for concept cards once the project has a React component testing setup.
