# Progress Insights Card Height Fix

- Date: 2026-04-09
- App affected: educoach
- Type of work: fix, UI

## Summary of what was implemented

Adjusted the `Progress Insights` desktop layout so the progress chart card and topic mastery card no longer stretch to the same height.

## Problem being solved

The two-column grid was using the default grid item stretch behavior. Because the topic mastery card is usually taller, the progress chart card was being stretched to match it, leaving a large block of empty white space under the chart and making the section look visually unbalanced.

## Scope of changes

- Updated the `Progress Insights` grid container to align items to the start instead of stretching them
- Kept the existing chart, topic mastery, CTA, and responsive column behavior unchanged

## Files/modules/screens/components/services affected

- `educoach/src/components/dashboard/ProgressInsightsSection.tsx`
- `educoach/docs/completed/2026-04-09-progress-insights-card-height-fix.md`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

- The progress chart card now hugs its content height
- The topic mastery card can remain taller without forcing extra white space on the chart side

## Developer notes or architectural decisions

- This was a layout fix only
- The issue came from CSS grid item stretching, not from the chart data or the card content itself

## Testing/verification performed

- Static code-path review of the updated layout class in `ProgressInsightsSection`

## Known limitations

- Automated frontend verification still could not be run in this environment because the local Node/npm toolchain is unavailable from this session

## Follow-up tasks or recommended next steps

- Manually verify the `Progress Insights` section on desktop and mobile breakpoints
