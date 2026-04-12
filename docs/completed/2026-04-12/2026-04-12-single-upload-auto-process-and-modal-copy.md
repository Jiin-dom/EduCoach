# Single Upload Auto-Process And Upload Modal Copy

## Date
2026-04-12

## App affected
`educoach`

## Type of work
fix

## Summary of what was implemented
Updated the web upload dialog so a single valid file upload starts document processing automatically, while multi-file uploads keep the deferred pending-document flow. For the single-file path, the dialog now restores the richer metadata form from the older upload experience, including document title, study goal name, and study goal completion date. The modal copy was also generalized so it no longer uses the word "bulk".

## Problem being solved
After the merge resolution, the upload dialog treated every upload as deferred batch work. That was correct for multiple files, but it made the common single-file case slower and less intuitive than before. The modal wording also still framed the flow as "bulk" even when a student was only uploading one file.

## Scope of changes
- Added a small helper that decides upload behavior from the count of valid files being uploaded.
- Reused that helper in the web upload dialog.
- Triggered `useProcessDocument()` automatically for the single-file path after the document row is created.
- Restored the single-file metadata form fields and saved them on insert.
- Reconnected single-file goal dates to goal-window scheduling after processing starts.
- Kept multi-file uploads as pending/deferred.
- Updated the upload modal title, description, and completion summary copy.
- Added a focused unit test for the new decision helper.

## Files/modules/screens/components/services affected
- `educoach/src/components/files/FileUploadDialog.tsx`
- `educoach/src/lib/documentBatchProcessing.ts`
- `educoach/src/lib/documentBatchProcessing.test.ts`

## Supabase impact
- **schema changes**: None
- **policy changes**: None
- **auth changes**: None
- **storage changes**: None
- **API/query changes**: None; the same upload + `process-document` flow is reused

## User-facing behavior changes
- Uploading exactly one valid file now starts processing automatically after upload.
- Single-file uploads again show `Document Title`, `Study Goal Name`, and `Study Goal (Completion Date)`.
- Uploading multiple valid files still creates pending documents for later processing from the Files page.
- The upload modal no longer says "bulk".
- Single-file completion copy now tells the student that processing started automatically.

## Developer notes or architectural decisions
- The behavior switch is based on the student selecting one file versus multiple files, which keeps the UI and saved behavior aligned with the modal shape.
- Single-file processing errors are logged but do not convert a successful upload into a fake upload failure; the Files page remains the source of truth for the final processing status.
- This change is web-only. The shared backend contract stays the same, so `educoach-mobile` does not need matching changes.

## Testing/verification performed
- Added a unit test for the helper that decides between immediate processing and deferred processing.
- Re-read the upload dialog to verify:
  - single-file path calls `useProcessDocument()`
  - single-file path restores and saves the richer metadata fields
  - multi-file path still inserts `pending` documents without auto-processing
  - modal copy no longer contains "bulk"
- Attempted to run:
  - `npm test -- src/lib/documentBatchProcessing.test.ts`
  - `npm run build`
- Automated command execution is still blocked in this environment by the local WSL/Node bridge issue, so fresh runtime verification could not complete from this shell.

## Known limitations
- Fresh automated verification is blocked until the workspace can run Node/npm commands successfully from the current environment or via approved external execution.

## Follow-up tasks or recommended next steps
- Run the targeted Vitest file and a web build as soon as the Node runtime issue is cleared.
- Manually smoke-test these cases in the browser:
  - one valid file
  - multiple valid files
  - one valid plus one invalid file
