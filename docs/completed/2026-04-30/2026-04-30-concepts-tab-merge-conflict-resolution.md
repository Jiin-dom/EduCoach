# Concepts Tab Merge Conflict Resolution

Date: 2026-04-30

App affected: educoach

Type of work: fix

## Summary

Resolved the merge conflict in `src/components/files/ConceptsTab.tsx` from merging `feature/files-UI` into the web app branch.

## Problem Being Solved

The merge combined two valid changes to the concepts tab:

- Learning review behavior from the current branch, including focused concept ordering and the `Mark Reviewed` action.
- Updated file UI presentation from `feature/files-UI`, including card-based concept layout and the expanded concept detail dialog.

The conflict needed to retain both behavior sets without introducing invalid nested interactive elements.

## Scope of Changes

- Kept the new concept card grid and expanded dialog layout.
- Kept focused concept prioritization and focused-card styling.
- Kept concept mastery lookup and due-review detection.
- Kept the `Mark Reviewed` action while preserving keyboard access on the card.
- Kept source page chips, keyword chips, importance display, and open affordance from the UI branch.

## Files/Modules/Screens/Components/Services Affected

- `src/components/files/ConceptsTab.tsx`

## Supabase Impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

The component continues to use the existing concept mastery hooks and mark-reviewed mutation. No shared Supabase contract was changed, so no mobile app update is required.

## User-Facing Behavior Changes

- Users keep the updated card-style concepts UI.
- Users still see focused or due concepts surfaced for review.
- Users can still mark tracked concepts as reviewed from the concept card.

## Developer Notes or Architectural Decisions

The card remains a keyboard-accessible `div` with `role="button"` rather than becoming an outer `button`, because the card contains a real `Mark Reviewed` button. This avoids invalid nested button markup while retaining keyboard open behavior.

## Testing/Verification Performed

- Checked that conflict markers were removed from `src/components/files/ConceptsTab.tsx`.
- Ran the web app production build with `npm run build`.

## Known Limitations

- No visual browser regression pass was performed for this merge conflict resolution.

## Follow-Up Tasks or Recommended Next Steps

- Review the concepts tab visually after completing the merge commit.
