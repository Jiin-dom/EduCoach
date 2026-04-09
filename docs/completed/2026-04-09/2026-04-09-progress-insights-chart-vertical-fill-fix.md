# Progress Insights Chart Vertical Fill Fix

- Date: 2026-04-09
- App affected: educoach
- Type of work: fix, UI

## Summary of what was implemented

Adjusted the `Progress Insights` chart card so the chart area expands vertically inside the equal-height dashboard row instead of leaving a large dead zone below the chart.

## Problem being solved

The dashboard row intentionally keeps the chart card and topic mastery card at equal height. The remaining visual issue was that the chart content itself was not growing to use the available height, so the extra card space collected underneath the chart as empty white area.

## Scope of changes

- Made the score-trend chart branch use a flex column that fills the available card height
- Made the chart container grow vertically with a minimum chart area
- Applied the same vertical-fill treatment to the activity heatmap fallback
- Kept the card layout, CTA, and topic mastery summary behavior unchanged

## Files/modules/screens/components/services affected

- `educoach/src/components/dashboard/ProgressInsightsSection.tsx`
- `educoach/docs/completed/2026-04-09-progress-insights-chart-vertical-fill-fix.md`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

- The progress chart now occupies more of the card height
- The chart card reads as intentionally sized rather than padded with empty space

## Developer notes or architectural decisions

- This keeps the dashboard summary row balanced without dropping equal-height cards
- The fix is inside the chart content layout, not the outer grid

## Testing/verification performed

- Static code-path review of the flex-fill chart layout

## Known limitations

- Automated frontend verification still could not be run in this environment because the local Node/npm toolchain is unavailable from this session

## Follow-up tasks or recommended next steps

- Visually verify score-trend and activity-heatmap states on desktop after refresh
