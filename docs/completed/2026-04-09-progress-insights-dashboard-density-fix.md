# Progress Insights Dashboard Density Fix

- Date: 2026-04-09
- App affected: educoach
- Type of work: fix, UI, refactor

## Summary of what was implemented

Rebalanced the `Progress Insights` dashboard row so both cards behave like summary cards instead of competing report panels.

## Problem being solved

After removing grid stretching, the `Progress Chart` card stopped wasting space, but the overall row looked visually uneven. The real issue was not card height alone. The `Topic Mastery` card was still acting like a long report while the chart card was acting like a compact summary.

## Scope of changes

- Restored equal-height peer cards in the `Progress Insights` row
- Limited the dashboard `Topic Mastery` card to the top 3 study materials
- Added a compact `+N more study materials` footer for overflow
- Kept full mastery detail in the premium analytics workspace
- Updated the dashboard helper so mastery summaries can be returned with or without a cap

## Files/modules/screens/components/services affected

- `educoach/src/components/dashboard/ProgressInsightsSection.tsx`
- `educoach/src/lib/dashboardInsights.ts`
- `educoach/src/lib/dashboardInsights.test.ts`
- `educoach/docs/completed/2026-04-09-progress-insights-dashboard-density-fix.md`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

- The `Progress Chart` and `Topic Mastery` cards now read as balanced dashboard summaries
- `Topic Mastery` now shows only the top 3 materials on the dashboard
- If more materials exist, the dashboard shows a `+N more` summary hint instead of expanding the whole card

## Developer notes or architectural decisions

- The dashboard should summarize, not duplicate, the full analytics workspace
- Equal-height cards work best here once the mastery list is bounded
- The longer mastery breakdown remains available through the CTA to premium analytics

## Testing/verification performed

- Added helper coverage for uncapped vs capped mastery summary output
- Performed static code-path review of the updated dashboard layout and capped summary behavior

## Known limitations

- Automated frontend verification still could not be run in this environment because the local Node/npm toolchain is unavailable from this session

## Follow-up tasks or recommended next steps

- Manually verify desktop and tablet layouts for the `Progress Insights` row
- Check cases with:
  - 0 mastery materials
  - 1-3 mastery materials
  - 4+ mastery materials
