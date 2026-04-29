# Study-Day Aware Scheduling

Date: 2026-04-30

App affected: both

Type of work: fix, backend

## Summary

New learning path and adaptive study tasks now use the app's local calendar day and respect the learner's selected study days when choosing a scheduled date.

## Problem Being Solved

When a user uploaded a document on Thursday, April 30, 2026 with available study days set to Monday, Tuesday, and Wednesday, generated activities could be scheduled for Wednesday, April 29, 2026. That made the learning path and dashboard show overdue work immediately after upload.

## Scope of Changes

- Updated web learning date helper behavior to use the local app date instead of an ISO UTC date string.
- Updated web goal-window scheduling to start from the local app date.
- Added a Supabase migration that moves generated adaptive study tasks to the next available study day on or after the app date.
- Added a contract test covering the client scheduling and backend migration behavior.

## Files, Modules, Screens, Components, Services Affected

- `src/lib/learningAlgorithms.ts`
- `src/lib/learningAlgorithms.test.ts`
- `src/services/goalWindowScheduling.ts`
- `scripts/study_day_scheduling_contract_test.py`
- `supabase/migrations/032_study_day_aware_adaptive_scheduling.sql`

## Supabase Impact

- Schema changes: none.
- Policy changes: none.
- Auth changes: none.
- Storage changes: none.
- API/query changes: `sync_adaptive_study_tasks_for_document` is replaced to use `available_study_days` and the Asia/Manila app date when scheduling adaptive quiz, flashcard, and review tasks.
- New helper functions: `study_day_id_for_date(date)` and `next_available_study_date(uuid, date)`.

## User-Facing Behavior Changes

- Newly generated adaptive study tasks are not scheduled in the past because of UTC date drift.
- If today is not one of the learner's selected study days, generated adaptive tasks move to the next selected study day.
- For a Monday/Tuesday/Wednesday learner uploading on Thursday, generated adaptive tasks start on the next Monday instead of the previous Wednesday.

## Developer Notes Or Architectural Decisions

- The existing `todayUTC()` function name was kept for compatibility, but its implementation now returns the local app date.
- The backend uses `NOW() AT TIME ZONE 'Asia/Manila'` to match the current app deployment locale and prevent database UTC dates from pulling tasks backward.
- Manual `user_scheduled_date` overrides continue to win over generated scheduled dates.

## Testing/Verification Performed

- `python3 scripts/study_day_scheduling_contract_test.py`
- `npx vitest run src/lib/learningAlgorithms.test.ts`
- `npx tsc --noEmit`

## Known Limitations

- Existing already-generated rows may need the sync function to run again before their scheduled dates are corrected.
- The backend app timezone is currently fixed to Asia/Manila.

## Follow-Up Tasks Or Recommended Next Steps

- Apply the Supabase migration in the deployed project.
- Trigger adaptive task sync for affected documents if stale rows already exist in production.
