## Phase 2 -- User Profiling & Core Data (Completed)

This document summarizes what was implemented for Phase 2: the profiling quiz that saves learning preferences to the database, Supabase Storage file upload utilities, the file upload dialog, and the React Query hooks for document CRUD.

---

## 1. High-Level Overview

- **Goal**: Save user learning preferences from the profiling quiz to the `user_profiles` table, and enable file uploads to Supabase Storage with full CRUD operations via React Query hooks.
- **Architecture**:
  - **ProfilingForm**: Multi-step wizard that collects learning style, study goals, preferred subjects, and daily study time, then persists via `AuthContext.updateProfile()`.
  - **Storage Utilities** (`storage.ts`): Robust file upload/download with validation, dead-socket detection, retry logic, and raw-fetch bypass to avoid Supabase client deadlocks.
  - **FileUploadDialog**: UI component for drag-and-drop or click-to-upload, with automatic document processing trigger after upload.
  - **useDocuments Hook**: React Query hooks for all document operations (list, detail, delete, update, process).

---

## 2. Profiling Form (`src/components/forms/ProfilingForm.tsx`)

A multi-step wizard with 4 steps:

### Step 1: Learning Style

Presents 4 learning style cards with icons:
- **Visual Learner** — learns through diagrams and charts
- **Auditory Learner** — learns through lectures and discussions
- **Reading/Writing Learner** — learns through reading and note-taking
- **Kinesthetic Learner** — learns through hands-on practice and examples

Each card uses a Lucide icon (`Eye`, `Headphones`, `BookOpen`, `PenTool`).

### Step 2: Study Goals

Free-text area where the user describes what they want to achieve.

### Step 3: Preferred Subjects

Multi-select from a predefined list:
- Computer Science, Mathematics, Physics, Chemistry, Biology, Engineering, Business, Economics, Psychology, History, Literature, Languages, Art & Design, Other

### Step 4: Daily Study Time

Radio-button selection:
- 15 min (Quick review)
- 30 min (Regular study)
- 60 min (Dedicated study)
- 90 min (Intensive learning)
- 120+ min (Deep immersion)

### Submission

On submit:
1. Calls `updateProfile()` from `AuthContext` with:
   - `learning_style`
   - `study_goal`
   - `preferred_subjects`
   - `daily_study_minutes`
   - `has_completed_profiling: true`
2. Navigates to `/dashboard` on success.

### Validation

Each step validates that required fields are filled before allowing progression:
- Step 1: Learning style must be selected.
- Step 2: Study goal must have content.
- Step 3: At least one subject selected.
- Step 4: Study duration selected.

---

## 3. Storage Utilities (`src/lib/storage.ts`)

A comprehensive module for file operations with Supabase Storage.

### 3.1. Configuration

- **Allowed file types**: PDF, DOCX, TXT, MD.
- **Maximum file size**: 10 MB.

### 3.2. File Validation (`validateFile`)

Checks:
- File is not empty.
- MIME type is in the allowed list.
- File size does not exceed 10 MB.
Returns a user-friendly error message or null if valid.

### 3.3. File Path Generation (`generateFilePath`)

Format: `{user_id}/{timestamp}_{sanitized_filename}`
- Sanitizes filename by removing special characters.
- Adds epoch timestamp for uniqueness.
- Ensures proper extension mapping.

### 3.4. Connection Warming (`warmConnection`)

- Makes a lightweight HEAD request to Supabase Storage before critical operations.
- Detects dead TCP sockets (killed when tabs are backgrounded).
- Does NOT call `getSession()` to avoid Web Lock deadlocks.
- Catches `ERR_HTTP2_PING_FAILED`, `ECONNRESET`, `TypeError: Failed to fetch`.
- After detecting a dead socket, makes a second request to force the browser to create a fresh connection.

### 3.5. Token Management

- **`getAccessTokenDirect()`** — Reads the Supabase access token directly from localStorage. Returns null if no token found (avoids silently falling back to anon key).
- **`getValidAccessToken()`** — Returns a non-expired access token. If expired, triggers a deduplicated session refresh via `ensureFreshSession()`, then re-reads. Throws if no valid token can be obtained.

### 3.6. Upload via Raw Fetch (`uploadWithTimeout`)

- Completely bypasses the Supabase JS client (and its internal `getSession()` Web Lock) to avoid deadlocks.
- Uses `AbortSignal.timeout()` so the fetch is genuinely cancelled on timeout (30 seconds).
- Makes a raw PUT request to `{supabaseUrl}/storage/v1/object/{bucket}/{filePath}` with the access token in the Authorization header.

### 3.7. Upload Flow (`uploadFile`)

1. Validate the file (type, size).
2. Generate a unique file path.
3. Warm the HTTP connection (detect dead sockets).
4. Get a valid access token.
5. Upload with 30-second timeout.
6. If upload times out → warm connection again → get fresh token → retry once.
7. Returns `{ data: { path }, error }`.

### 3.8. Other Utilities

- **`deleteFile(filePath)`** — Deletes a file from Supabase Storage.
- **`getFileUrl(filePath, expiresIn)`** — Gets a signed URL valid for 1 hour (default).
- **`downloadFileAsText(filePath)`** — Downloads file content as text (for txt, md).
- **`downloadFileAsBlob(filePath)`** — Downloads file as Blob (for PDFs).
- **`getFileTypeFromMime(mimeType)`** — Maps MIME type to file extension.
- **`formatFileSize(bytes)`** — Formats bytes as KB/MB for display.

---

## 4. File Upload Dialog (`src/components/files/FileUploadDialog.tsx`)

A modal dialog for file uploads with these features:

### 4.1. File Selection

- Drag-and-drop zone with visual feedback.
- Click-to-browse fallback.
- Accepts only allowed MIME types (PDF, DOCX, TXT, MD).
- Shows file name, size, and type after selection.

### 4.2. Upload Flow

1. User selects a file.
2. Optionally enters a custom title (defaults to filename).
3. Clicks "Upload".
4. **Status transitions**: `idle` → `uploading` → `processing` → `complete` (or `error`).
5. On upload success:
   - Creates a `documents` row in the database via Supabase client (`supabase.from('documents').insert()`).
   - Triggers document processing via `useProcessDocument()` mutation (calls the `process-document` Edge Function).
6. Shows progress feedback for each stage.

### 4.3. Integration

- Uses `uploadFile()` from `storage.ts` for the actual upload.
- Uses `ensureFreshSession()` before creating the database row.
- Uses `useProcessDocument()` hook to trigger the Edge Function.
- Calls `onUploadComplete()` callback when done (invalidates document list cache).

---

## 5. React Query Hooks (`src/hooks/useDocuments.ts`)

Centralizes all document data access with React Query.

### 5.1. Types

- **`Document`** — Mirrors the `documents` table (id, user_id, title, file_name, file_path, file_type, file_size, status, error_message, summary, concept_count, processed_by, timestamps).
- **`DocumentProcessor`** — `'pure_nlp' | 'gemini'`.
- **`ProcessDocumentInput`** — `{ documentId, processor? }`.

### 5.2. Query Keys

```typescript
documentKeys = {
    all: ['documents'],
    lists: () => ['documents', 'list'],
    list: (filters) => ['documents', 'list', filters],
    details: () => ['documents', 'detail'],
    detail: (id) => ['documents', 'detail', id],
}
```

### 5.3. Queries

- **`useDocuments()`** — Fetches all documents for the current user, ordered by `created_at DESC`.
- **`useDocument(documentId)`** — Fetches a single document by ID.
- **`useDocumentStats()`** — Returns document counts grouped by status (pending, processing, ready, error).

### 5.4. Mutations

- **`useDeleteDocument()`** — Deletes the document row from the database AND the file from Supabase Storage. On success: removes from cache optimistically, invalidates document list.
- **`useUpdateDocument()`** — Updates a document's title or status. On success: updates cache, invalidates list.
- **`useProcessDocument()`** — Triggers the `process-document` Edge Function. Uses `ensureFreshSession()` before the call. Handles user-friendly error parsing. On success: invalidates both document and concept caches.

All hooks follow the established React Query pattern: `enabled` guards on user/id, `abortSignal` for cancellation, cache key hierarchy for targeted invalidation.

---

## 6. Files Content Page (`src/components/files/FilesContent.tsx`)

The main file listing page, updated to use real data:

- Fetches documents via `useDocuments()`.
- Shows file icon, title, type, size, upload date.
- Status badge per document (pending, processing, ready, error) with appropriate colors.
- Actions per document:
  - **Process** (for pending/error documents) — triggers `useProcessDocument()`.
  - **Refine with Gemini** (for ready documents) — re-processes with Gemini processor.
  - **Generate Quiz** (for ready documents) — triggers quiz generation (Phase 4).
  - **Delete** — removes file from storage and database.
  - **View** — navigates to `/files/:id`.
- Upload button opens `FileUploadDialog`.

---

## 7. Files Created

| File | Purpose |
|------|---------|
| `src/lib/storage.ts` | Upload, download, delete, validation utilities |
| `src/hooks/useDocuments.ts` | React Query hooks for document CRUD |

## 8. Files Modified

| File | Change |
|------|--------|
| `src/components/forms/ProfilingForm.tsx` | Replaced localStorage with AuthContext.updateProfile() |
| `src/components/files/FileUploadDialog.tsx` | Upload to Supabase Storage + create document row + trigger processing |
| `src/components/files/FilesContent.tsx` | Switched from mock data to real data via useDocuments() |
| `src/contexts/AuthContext.tsx` | Added updateProfile() method |

---

## 9. How to Deploy Phase 2

1. **Ensure Phase 1 is deployed** (auth + database tables + storage bucket)
2. **Rebuild the frontend**: The new TypeScript files and modified components will be included automatically
3. **No new Edge Functions or migrations needed** for Phase 2 itself — the `documents` table and storage bucket were created in Phase 1's migration

---

## 10. Verification Checklist

- **Profiling**
  - Sign up a new account → redirected to `/profiling`
  - Complete all 4 steps of the profiling wizard
  - Verify: `user_profiles` row is updated with learning_style, study_goal, preferred_subjects, daily_study_minutes, and `has_completed_profiling = true`
  - Verify: redirected to `/dashboard` after submission

- **File Upload**
  - Navigate to `/files` and click "Upload"
  - Select a PDF, DOCX, TXT, or MD file
  - Verify: file appears in the file list with status `pending` → `processing` → `ready`
  - Verify: file exists in Supabase Storage under `documents/{user_id}/`
  - Verify: `documents` row created with correct metadata

- **File Management**
  - Delete a file → verify it's removed from both the database and storage
  - Upload after backgrounding the tab for 30+ seconds → verify upload succeeds (connection warming works)

- **Validation**
  - Try uploading a file > 10 MB → verify error message
  - Try uploading a .exe file → verify rejection
  - Try accessing `/dashboard` before completing profiling → verify redirect to `/profiling`

With these pieces in place, **Phase 2 -- User Profiling & Core Data is fully implemented** and provides the user onboarding flow and file management infrastructure for the document processing pipeline.
