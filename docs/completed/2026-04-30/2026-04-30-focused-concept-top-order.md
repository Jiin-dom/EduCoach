# Focused Concept Top Order

Date: 2026-04-30

App affected: educoach

Type of work: UI, fix

## Summary

Updated the web File Detail Concepts tab so concept review links from Learning Path place the targeted concept at the top of the list.

## Problem Being Solved

Web review links carried the focused concept id and highlighted the right concept, but normal concept sorting could still place the target below other concepts.

## Scope Of Changes

- Preserved the existing `concept` query parameter behavior.
- Kept normal filtering and sorting for non-focused concepts.
- Promoted the focused concept to the first list position after sorting when it is present.

## Files/Modules/Screens/Components/Services Affected

- `src/components/files/ConceptsTab.tsx`
- `scripts/mark_concept_reviewed_contract_test.py`

## Supabase Impact

- Schema changes: none.
- Policy changes: none.
- Auth changes: none.
- Storage changes: none.
- API/query changes: none.

## User-Facing Behavior Changes

- Learning Path review links open the document Concepts tab with the target concept first.
- The focused concept remains highlighted and keeps Mark Reviewed.

## Developer Notes Or Architectural Decisions

- Focus promotion is applied after sorting so the rest of the list keeps the selected sort order.
- Search still acts as a hard filter; a non-matching focused concept is not forced into filtered results.

## Testing/Verification Performed

- `python3 scripts/mark_concept_reviewed_contract_test.py` passed.
- `npx tsc --noEmit` passed.

## Known Limitations

- No smooth scroll behavior was added because the concept is placed at the top instead.

## Follow-Up Tasks Or Recommended Next Steps

- Consider adding a small "From study plan" label on the focused concept card if users need more context.

