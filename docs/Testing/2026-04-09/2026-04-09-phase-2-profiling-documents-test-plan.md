# Phase 2 Profiling, Core Data & Document Library Test Plan

- Date: 2026-04-09
- Feature area: Profiling, core data, document library, assign deadline foundation
- Dependency map: `educoach/docs/info/dependency-maps/phase-2-profiling-documents-dependency-map.md`
- Current routes: `/profiling`, `/dashboard`, `/files`

## Cross-checked scope

This plan is based on:

- `src/components/forms/ProfilingForm.tsx`
- `src/components/files/FileUploadDialog.tsx`
- `src/components/files/FilesContent.tsx`
- `src/components/dashboard/DashboardContent.tsx`
- `src/hooks/useDocuments.ts`
- `src/hooks/useGoalWindowScheduling.ts`

## Core scenarios

### 1. Complete profiling

- Open `/profiling` as an unprofiled student.
- Fill out display name, study goal, study time, and available days.
- Save.
- Expected:
  - profile updates successfully
  - student can access normal protected routes afterward

### 2. Upload a valid study file

- From `/files`, upload a valid supported document.
- Expected:
  - upload succeeds
  - document appears in the library
  - processing starts and status updates

### 3. Upload from dashboard

- From `/dashboard`, upload a document using the shared upload flow.
- Expected:
  - uploaded file appears in both dashboard summaries and `/files`
  - shared upload behavior matches the files page

### 4. Document list and detail access

- Open `/files`.
- Open one document from the list.
- Expected:
  - list renders correctly
  - selected document opens at `/files/:id`

### 5. Edit document title or target dates

- Update a document title or planning date if that UI is available from the current flow.
- Expected:
  - document metadata persists
  - related views refresh automatically

### 6. Delete a document

- Delete a document from the file library.
- Expected:
  - document disappears from the list
  - detail page becomes inaccessible
  - no stale card remains on the dashboard

### 7. Goal-window scheduling on upload with exam date

- Upload a document and assign an `exam_date`.
- Expected:
  - goal-window scheduling runs
  - downstream learning-path placeholders can be created

## Edge cases

- unsupported file type
- file exceeds allowed size
- upload interrupted mid-flight
- processing stuck or error status after upload
- deleting a document that is still processing
- user submits profiling with invalid time window or no available study day

## Validation points

- document polling refreshes status automatically
- `/dashboard` and `/files` stay consistent because they share the same document hooks
- date-related edits do not require a hard refresh

## Pass criteria

- Profiling, upload, listing, open, update, and delete flows work from the current shared document library.
- Basic planning metadata and document state stay synchronized across dashboard and files pages.
