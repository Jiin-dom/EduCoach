# Quiz Generation Supplement Import Fix

**Date:** 2026-03-31
**App affected:** both
**Type of work:** fix

## Summary of what was implemented

Fixed the shared `generate-quiz` Supabase Edge Function so its NLP supplementation path correctly imports and calls `countQuestionsByType`. Added a regression test in the web workspace that checks the edge-function source imports helper functions it uses from `quizAllocation.ts`.

## Problem being solved

Quiz generation could fail after the initial NLP pass returned fewer questions than requested. In that fallback path, the Edge Function called `countQuestionsByType(...)` without importing it, producing the runtime error `countQuestionsByType is not defined`. Mobile exposed the issue during quiz generation, while web appeared fine when its requests did not enter that branch.

## Scope of changes

- Updated the shared Supabase Edge Function import list
- Added a regression test that guards the helper import contract for `generate-quiz`
- Documented the cross-platform backend impact

## Files/modules/screens/components/services affected

- `supabase/functions/generate-quiz/index.ts`
- `src/lib/generateQuizEdgeFunctionImport.test.ts`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

- Quiz generation no longer crashes when the NLP service returns fewer questions than requested and the server enters the supplementation branch.
- Both `educoach` and `educoach-mobile` benefit after the `generate-quiz` function is redeployed.

## Developer notes or architectural decisions

- The root cause was in shared backend code, not in the mobile client request path.
- The regression guard was placed in the web workspace because Vitest is already configured there, while the Edge Function itself lives under the same repository tree.

## Testing/verification performed

- Reviewed the Supabase runtime log showing `countQuestionsByType is not defined`
- Compared web and mobile quiz-generation payloads and confirmed both hit the same shared Edge Function
- Confirmed the source referenced `countQuestionsByType(...)` without importing it before the fix
- Added a regression test file for the missing-import case
- Attempted to run the Vitest test, but this environment could not execute Node tooling (`npm test` failed in WSL with environment/runtime issues)
- Re-checked the source after the patch to confirm the helper is now imported

## Known limitations

- The regression test could not be executed in this container because Node/Deno tooling is unavailable or blocked in the current WSL environment.
- The fix is not live until `generate-quiz` is redeployed to Supabase.

## Follow-up tasks or recommended next steps

1. Redeploy the Edge Function: `npx supabase functions deploy generate-quiz`
2. Re-run quiz generation in `educoach-mobile` using the same document/request shape that previously failed
3. Run the new Vitest regression test from a working Node environment
