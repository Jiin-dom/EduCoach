# Bulk Upload Deferred Processing Test Plan

- Date: 2026-04-09
- Feature area: bulk upload, deferred document processing, capped batch queue
- Routes: `/files`, `/dashboard`
- Dependency map: `educoach/docs/info/dependency-maps/phase-2-profiling-documents-dependency-map.md`

## Cross-checked scope

This plan is based on:

- `src/components/files/FileUploadDialog.tsx`
- `src/components/files/FilesContent.tsx`
- `src/components/dashboard/DashboardContent.tsx`
- `src/hooks/useDocuments.ts`
- `src/lib/documentBatchProcessing.ts`

## Core scenarios

### 1. Bulk upload valid files from `/files`

- Open `/files`.
- Start the upload dialog.
- Select 3 valid supported files in one batch.
- Complete the upload.
- Expected:
  - all 3 files upload successfully
  - 3 new document rows appear in the library
  - each new document shows `pending`
  - processing does not start automatically
  - upload summary clearly says the files were uploaded as pending

### 2. Mixed batch upload with invalid files

- Open `/files`.
- Select a mixed batch:
  - at least 1 valid file
  - at least 1 unsupported file type or oversize file
- Complete the upload.
- Expected:
  - valid files still upload
  - invalid files remain in the batch list with row-level errors
  - upload does not fail as one all-or-nothing action
  - successfully uploaded files still appear in the library as `pending`

### 3. Upload cleanup on document insert failure

- Force or simulate a failure after storage upload but before the `documents` insert completes.
- Complete one upload attempt.
- Expected:
  - the upload row shows an error
  - no orphaned `documents` row appears
  - the uploaded storage object is deleted as cleanup

### 4. Process a single pending document

- Upload one valid file so it appears as `pending`.
- Use the per-file process action.
- Expected:
  - the file transitions from `pending` to `processing`
  - after backend completion it becomes `ready` or `error`
  - the library refreshes without a manual hard reload

### 5. Process all pending with concurrency cap `2`

- Upload at least 4 valid files so all appear as `pending`.
- Click `Process All Pending`.
- Expected:
  - only 2 files are actively processing at the same time
  - the remaining pending files show as locally queued or remain pending until claimed
  - the batch summary updates counts for started, ready, failed, and skipped
  - when one active job finishes, the next queued pending file starts

### 6. Prevent duplicate batch runs

- While `Process All Pending` is already running, try to:
  - click `Process All Pending` again
  - trigger per-file processing on a pending row
- Expected:
  - duplicate local batch starts are blocked
  - per-file processing is disabled while the local batch run is active
  - no document is double-started from the same browser session

### 7. Refresh and resume after partial batch progress

- Start `Process All Pending` on at least 4 pending files.
- Refresh the page while 1 or 2 files are still processing.
- Return to `/files`.
- Expected:
  - docs already set to backend `processing` still show as processing
  - remaining untouched docs still show as `pending`
  - clicking `Process All Pending` again resumes from the remaining pending docs
  - no special server-side queue state is required for recovery

### 8. Delete a queued or pending document

- Create a batch large enough to have queued docs during `Process All Pending`.
- Delete one file that is still pending or client-derived queued.
- Expected:
  - the file is removed from the list
  - if it was queued, it is removed from the local batch runner
  - batch totals update cleanly
  - deleting one queued file does not stop the rest of the batch

### 9. Block delete for actively processing documents

- Start processing for a document.
- Try to delete it while it is actively processing.
- Expected:
  - delete action is disabled or blocked
  - tooltip or affordance makes it clear why deletion is not allowed yet

### 10. Retry failed processing

- Force or use a document that fails processing and lands in `error`.
- Use the retry action from the file row.
- Expected:
  - retry is available for errored documents
  - the document re-enters the processing flow
  - final status updates correctly after retry

### 11. Dashboard entry-point behavior

- Open `/dashboard`.
- Use the study-material actions from the dashboard card.
- Expected:
  - dashboard does not open the full batch upload workflow inline
  - dashboard routes the user into `/files` for file management
  - recent-file cards still reflect shared document state from the library

### 12. Cross-view consistency

- Upload files from `/files`.
- Process one file individually and another via batch.
- Check `/dashboard` and `/files`.
- Expected:
  - document statuses remain consistent across both views
  - no stale cards remain after deletes or status changes
  - ready/error transitions are visible without a full sign-out/in cycle

## Edge cases

- duplicate filenames in the same batch
- upload dialog cancel and reopen before processing starts
- user refreshes after upload but before any processing
- mixed processing outcomes in one batch
- backend status changes between local queue claim and actual process start
- empty-state behavior when there are no files or no pending files

## Validation points

- bulk upload is web-only in practice and centered on `/files`
- persisted backend statuses remain:
  - `pending`
  - `processing`
  - `ready`
  - `error`
- `queued` is client-derived only during a local batch run
- no automatic processing happens immediately after upload
- `Process All Pending` never exceeds 2 concurrent processing jobs from the local batch runner
- the existing shared `process-document` backend path is reused rather than forked

## Shared-backend smoke checks

Because `educoach-mobile` shares the same Supabase backend, do a quick regression smoke check after web verification:

- mobile single-file upload still works
- mobile single-file processing still works
- mobile still reads the unchanged persisted document statuses correctly

## Pass criteria

- Users can upload multiple files in one batch from `/files`.
- Uploaded files land as `pending` without immediate processing.
- Batch processing works through `Process All Pending` with a hard cap of 2 active jobs.
- Pending, queued, processing, ready, and error behavior is understandable in the web UI.
- Delete and retry behaviors follow the intended V1 rules.
- Dashboard remains consistent while bulk workflow stays scoped to the Files library.
