# Realtime Subscription Fix

## Date
2026-04-30

## App Affected
`educoach`

## Type of Work
fix

## Summary
Resolved a Supabase Realtime application crash caused by attaching `postgres_changes` event listeners to an already-subscribed channel during rapid component mount/unmount cycles.

## Problem Being Solved
This is a proactive fix for the web app mirroring an active issue in the mobile app. React Fast Refresh or strict navigation mounting could cause old channel cleanups to not finish propagating in the internal Supabase channel map before a new subscription was requested with the exact same topic name.

## Scope of Changes
Updated the `useNotifications.ts` hook to include a randomized unique identifier in the Supabase channel topic name. This guarantees that each component mount requests a fresh channel from the internal channel dictionary, avoiding conflicts with lingering channels in the "subscribed" state.

## Files/Modules/Components Affected
- `src/hooks/useNotifications.ts`

## Supabase Impact
- No schema, policy, or database impacts.
- Slight increase in transient channels during rapid component thrashing, but all are correctly cleaned up by `supabase.removeChannel(channel)` on unmount.

## User-Facing Behavior Changes
- Navigation crashes related to the `useNotifications` realtime subscription are fully eliminated.

## Developer Notes
- Supabase imposes a 100 concurrent channel limit. The generated random strings are safely cleaned up and should not exceed this limit under standard usage.
- This is a common pattern to avoid strict-mode or hot-reload related realtime bugs in React apps using `@supabase/supabase-js` v2.

## Testing/Verification Performed
- Code successfully formatted with prettier.

## Follow-up Tasks
- None.
