# Learning Path Availability Alignment

- Date: 2026-04-09
- App affected: educoach
- Type of work: behavior update, UX confirmation, scheduling alignment

## Summary of what was implemented

Implemented confirmation-driven profile save behavior for study availability edits and added a strict post-replan alignment pass so future learning-path due dates no longer remain on disallowed study days.

## Problem being solved

Students could change profile availability (for example, remove Friday), but some future learning-path items could still remain on removed days because only goal-window placeholder reassignment was guaranteed.

## Scope of changes

- Added a profile confirmation modal when schedule-affecting availability fields are changed.
- Added explicit user choice to:
  - adjust learning path now, or
  - save profile and keep current path for now.
- Added an availability-alignment pass after replanning to shift future due dates from disallowed days to the next allowed day.
- Kept recalculation of `priority_score` in sync with shifted due dates.
- Ensured alignment still runs even when no goal-dated documents are present.

## Files/modules/screens/components/services affected

- `src/components/profile/ProfileContent.tsx`
- `src/hooks/useGoalWindowScheduling.ts`
- `src/services/goalWindowScheduling.ts`
- `docs/implementation/learning-path-replanning-behavioral-spec.md`
- `docs/Testing/2026-04-09/2026-04-09-profile-account-settings-test-plan.md`

## User-facing behavior changes

- Saving availability changes now asks whether to adjust the learning path immediately.
- If the student confirms adjustment, future learning-path items are aligned to allowed study days.
- If the student keeps the current path, profile settings are still saved without immediate schedule shifts.

## Testing/verification performed

- Confirmed TypeScript/lint status for touched source files in this environment.
- Updated manual test coverage to include day-removal regression (example: remove Friday, verify future Friday items shift).

## Known limitations

- Alignment is date-based and does not yet redistribute by per-day load-balancing beyond existing capacity heuristics.
- Overdue or same-day urgency behavior remains driven by existing mastery/deadline logic.
