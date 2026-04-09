# EduCoach Bulk Upload With Deferred Processing

## Date
2026-04-09

## App affected
`educoach`

## Type of work
feature

## Summary of what was implemented
Added a web-only bulk upload flow for study materials on the `/files` page. Files now upload first into the library as `pending` documents, and processing is intentionally deferred until the user triggers it later. The Files page now includes a `Process All Pending` action that processes documents with a concurrency cap of `2`, plus client-visible queued/processing feedback.

## Problem being solved
The previous web flow was strictly single-file and immediately tried to process the uploaded file in the same dialog. That worked for one file, but it was the wrong shape for semester-scale intake because the user had to wait through the expensive NLP pipeline instead of simply getting all materials into the library first.

## Scope of changes
- Reworked the web upload dialog to support multi-file selection and drag-drop.
- Removed immediate processing from the upload dialog.
- Added upload-side cleanup when storage upload succeeds but DB insert fails.
- Added deferred batch processing controls to the Files page.
- Kept the shared backend document lifecycle and Edge Function contract unchanged.
- Redirected the dashboard upload actions into the Files library instead of reusing the full batch uploader there.
- Updated workflow/dependency documentation to reflect the new behavior.

## Files/modules/screens/components/services affected
- `educoach/src/components/files/FileUploadDialog.tsx`
- `educoach/src/components/files/FilesContent.tsx`
- `educoach/src/hooks/useDocuments.ts`
- `educoach/src/lib/documentBatchProcessing.ts`
- `educoach/src/lib/documentBatchProcessing.test.ts`
- `educoach/src/components/dashboard/DashboardContent.tsx`
- `educoach/docs/workflow-guide/Document_Processing_Workflow.md`
- `educoach/docs/workflow-guide/educoach-user-flow.md`
- `educoach/docs/info/dependency-maps/phase-2-profiling-documents-dependency-map.md`

## Supabase impact
- **schema changes**: None
- **policy changes**: None
- **auth changes**: None
- **storage changes**: None to bucket structure or policies; added client-side cleanup on insert failure after upload
- **API/query changes**: None to the shared Edge Function contract; reused the existing `process-document` path for deferred processing

## User-facing behavior changes
- The `/files` upload dialog now accepts multiple files in one batch.
- Uploaded files appear in the library as `pending` instead of being processed immediately.
- The Files page now exposes `Process All Pending`.
- At most two files are processed at once from the local batch runner.
- The library now communicates queued vs processing states more clearly during batch runs.
- The dashboard no longer launches the full uploader inline; it routes users into the Files library to manage bulk work.

## Developer notes or architectural decisions
- V1 intentionally preserves the persisted backend status model:
  - `pending`
  - `processing`
  - `ready`
  - `error`
- `queued` is derived on the client only so `educoach-mobile` is not forced into a backend contract change.
- The batch runner is resumable from current DB truth because it rebuilds work from fresh pending documents instead of relying on a durable server-side queue.
- Goal-date capture was intentionally kept out of the bulk upload V1 flow to avoid turning the uploader into a per-row metadata form.

## Testing/verification performed
- Added a new utility-level Vitest file for batch-processing helper behavior:
  - default title derivation
  - pending-document selection
  - client-side queued/processing status mapping
- Attempted to run the new targeted test command:
  - `npm test -- src/lib/documentBatchProcessing.test.ts`
- Verification is blocked in the current shell because the available Node/npm entry points resolve to an unusable WSL/Windows bridge and do not execute Vitest successfully in this environment.
- Performed code-path verification by cross-checking the shared backend flow and ensuring the existing `process-document` request logic is reused rather than forked.

## Known limitations
- Automated test execution could not be completed from this shell due the environment’s Node/npm runtime issue.
- `queued` is not a persisted backend status; it is visible only while the local web batch runner is active.
- Batch processing coordination is local to the current browser session and does not provide cross-tab distributed locking.
- Goal dates / `exam_date` are not set during bulk upload V1.

## Follow-up tasks or recommended next steps
- Run the web Vitest target and a full build once a working Node/npm runtime is available.
- Exercise the web batch flow manually with mixed valid/invalid files and mid-run refreshes.
- Smoke-test the unchanged mobile single-file flow against the shared backend.
- Consider a later hardening phase with:
  - signed upload tickets
  - server-enforced upload limits
  - a persisted `uploading` state if the product needs stronger queue semantics.
