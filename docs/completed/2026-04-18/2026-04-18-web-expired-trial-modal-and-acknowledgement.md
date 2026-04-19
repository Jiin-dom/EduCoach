# Web Expired Trial Modal And Acknowledgement

Date: 2026-04-18

App affected: educoach

Type of work: UI, fix

## Summary of what was implemented

- Added a web dashboard expired-trial modal aligned with the mobile experience.
- Persisted acknowledgement in browser storage so the same expired-trial notice does not keep showing for the same user and trial end date.
- Removed the old persistent inline expired-trial card to avoid conflicting notification patterns.

## Problem being solved

- Web did not match the new mobile expired-trial notification behavior.
- The existing web experience used a persistent inline card instead of a one-time acknowledgement modal.

## Scope of changes

- Updated `DashboardContent` to add modal-based expired-trial notification logic.
- Added browser `localStorage` acknowledgement persistence keyed by `user.id` and `trialEndsAt`.
- Added a contract test to lock the behavior in place.

## Files/modules/screens/components/services affected

- `educoach/src/components/dashboard/DashboardContent.tsx`
- `educoach/scripts/web_expired_trial_notice_contract_test.py`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

- When a free trial has expired on web, users now see a readable modal with `Upgrade to premium` and `Got it` actions.
- The modal explains that study materials stay in the library while premium-only tools are locked.
- After the modal has been shown for the current expired trial on that browser, it does not appear again.

## Developer notes or architectural decisions

- The acknowledgement key is derived from `user.id` and `trialEndsAt`, which allows a future trial-state change to trigger a new notice.
- Persistence is local to the browser via `localStorage`, which keeps this aligned with the mobile device-local acknowledgement behavior without backend changes.

## Testing/verification performed

- Ran `python3 educoach/scripts/web_expired_trial_notice_contract_test.py`

## Known limitations

- Acknowledgement is browser-local, not synced across devices.
- No TypeScript build verification was run in this shell.

## Follow-up tasks or recommended next steps

- If product wants cross-device acknowledgement, store the expired-trial notice state in Supabase instead of local browser storage.
- Re-run full web type-check/build if needed in a working Node environment.
