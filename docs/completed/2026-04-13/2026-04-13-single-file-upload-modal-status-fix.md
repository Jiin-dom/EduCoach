# Single-File Upload Modal Status Fix

- Date: 2026-04-13
- App affected: educoach
- Type of work: fix

## Summary of what was implemented
- Fixed the upload study material modal so a completed single-file upload keeps the correct in-modal status copy: `Uploaded and processing started`.
- Added a shared helper for upload item status labels so the modal does not depend on a transient `uploadableItems.length` check after upload completion.
- Added a regression test covering the single-file immediate-processing label.

## Problem being solved
- A single uploaded file was processed immediately as intended, and the Files page correctly showed the document as `Ready`.
- The upload modal row still changed to `Uploaded as pending` after the upload completed because its label logic depended on whether the item was still counted as uploadable.
- That created a misleading mismatch between the modal and the persisted document state.

## Scope of changes
- Updated shared upload-status helper logic in the web app.
- Updated the upload study material modal to use the shared helper.
- Added a regression test for the single-file uploaded label.

## Files/modules/screens/components/services affected
- `educoach/src/lib/documentBatchProcessing.ts`
- `educoach/src/lib/documentBatchProcessing.test.ts`
- `educoach/src/components/files/FileUploadDialog.tsx`

## Supabase impact
- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes
- In the upload study material modal, a successful single-file upload now continues to show that processing started automatically instead of incorrectly saying the file was uploaded as pending.
- Multi-file uploads still show the pending wording.

## Developer notes or architectural decisions
- The fix intentionally keeps the source of truth for the modal label tied to `uploadMode`, which is stable for the upload batch, instead of `uploadableItems.length`, which drops to zero after a successful upload.
- This is a UI-only fix. The actual upload, insert, and document processing flow was not changed.
- Mobile impact was checked conceptually: no shared Supabase contract or backend behavior changed, so `educoach-mobile` does not need a parallel update for this fix.

## Testing/verification performed
- Ran `npm test -- src/lib/documentBatchProcessing.test.ts`
- Ran `npm run build`
- Verified the regression test covers the incorrect single-file modal label after upload completion.

## Known limitations
- The modal still reflects the batch upload mode, not live document polling from the database, so it does not switch to `Ready` in-place after backend processing completes.
- Build output still reports the existing large chunk warning from Vite; this fix did not change bundle splitting.

## Follow-up tasks or recommended next steps
- If desired, add an optional lightweight post-upload status refresh in the modal so single-file uploads can transition from `processing started` to `Ready` without requiring the user to rely on the Files page.
