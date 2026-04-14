# Dashboard Progress Insights Order Fix

- Date: 2026-04-09
- App affected: educoach
- Type of work: fix, UI

## Summary of what was implemented

Moved the `Progress Insights` section lower on the dashboard so it now appears after the three-card row containing `Study Materials`, `Available Quizzes`, and `Weak Topics`.

## Problem being solved

The dashboard content order did not match the requested reading flow. `Progress Insights` was displayed before the three core dashboard cards, which made the page feel out of sequence for the intended layout.

## Scope of changes

- Reordered the dashboard sections in `DashboardContent`
- Kept the existing cards, data hooks, and section behavior unchanged

## Files/modules/screens/components/services affected

- `educoach/src/components/dashboard/DashboardContent.tsx`
- `educoach/docs/completed/2026-04-09/2026-04-09-dashboard-progress-insights-order-fix.md`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

- Dashboard users now see `Study Materials`, `Available Quizzes`, and `Weak Topics` before `Progress Insights`
- The content inside each section remains the same; only the vertical ordering changed

## Developer notes or architectural decisions

- This was a presentation-order adjustment only
- No shared backend behavior or cross-app Supabase logic was changed

## Testing/verification performed

- Ran the web app production build to confirm the reordered dashboard still compiles successfully

## Known limitations

- This change was verified by successful build output, not by an interactive browser check in this session

## Follow-up tasks or recommended next steps

- Open the dashboard in the browser and confirm the new section order feels right on desktop and mobile breakpoints
