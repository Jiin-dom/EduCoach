# Baseline Quiz Auto-Generation Restore

Date: 2026-04-29

App affected: both

Type of work: fix, backend

## Summary
Restored automatic baseline quiz generation after a document is successfully processed. The baseline quiz is generated from the same shared Supabase/NLP backend used by manual quiz generation.

## Problem Being Solved
A previous baseline quiz flow was introduced in upload handling, then later moved toward adaptive review sync. The current branch did not remove it directly in commit `95eb43a`, but the active code no longer created a first baseline quiz after processing. Adaptive review sync can skip when no mastery rows exist, which is normal immediately after a new upload.

## Scope Of Changes
- Added baseline quiz generation after successful `process-document` completion.
- Added recovery-path baseline generation when the edge function response fails but the document is already `ready`.
- Skips generation if a non-review quiz already exists for the same document.
- Keeps baseline generation non-fatal: the document remains ready even if quiz generation fails.

## Files Affected
- `src/hooks/useDocuments.ts`
- `../educoach-mobile/src/hooks/useDocuments.ts`

## Supabase Impact
Schema changes: none.

Policy changes: none.

Auth changes: none.

Storage changes: none.

API/query changes: both clients now call the existing `generate-quiz` Edge Function after `process-document` succeeds, using the existing quiz generation contract.

## User-Facing Behavior Changes
After a single document is processed successfully, EduCoach will attempt to create an initial baseline quiz automatically. Existing ready or generating non-review quizzes prevent duplicate baseline quiz creation.

## Developer Notes
The fix intentionally does not use adaptive review sync for the first quiz because new documents often have no mastery data yet. Adaptive review quizzes remain separate and continue to use `Review Quiz:` titles.

## Testing/Verification Performed
- Ran `npm test` in `educoach`: 14 test files passed, 139 tests passed.
- Ran `npm run build` in `educoach` after the change.
- Ran `npx tsc --noEmit` in `educoach-mobile`; it still fails due pre-existing project-wide type errors unrelated to this change.

## Known Limitations
Baseline quiz generation still depends on the `generate-quiz` Edge Function and NLP/Gemini availability. If generation fails, the document remains ready and the failure is logged as non-fatal.

## Follow-Up Tasks
- Consider moving baseline quiz generation fully server-side after `process-document` for better reliability if users close the app mid-processing.
- Clean up existing mobile TypeScript errors so future mobile verification can be stricter.
