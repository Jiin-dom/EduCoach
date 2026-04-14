## Feature: Assign Deadline (Completed)

This document summarizes the current scheduling/date implementation for uploaded study materials.

---

## 1. High-Level Overview

- **Goal**: Allow users to attach an optional target date to uploaded study materials and display schedule metadata in the file list.
- **Architecture**:
  - **Database**: `documents` supports both `deadline` and `exam_date`.
  - **Types/Hooks**: Frontend `Document` type and update hook support both fields.
  - **Frontend UI**: Upload flow currently captures a "Study Goal (Completion Date)" and writes it to `exam_date`. List UI displays both `deadline` and `exam_date` badges when present.

---

## 2. Database Schema

Relevant migrations:
- `012_add_deadline_to_documents.sql`
- `016_add_exam_date_to_documents.sql`

| Column | Type | Notes |
|--------|------|-------|
| `deadline` | `TIMESTAMPTZ` (nullable) | Due date used by learning path/deadline-aware flows. |
| `exam_date` | `TIMESTAMPTZ` (nullable) | Upload "Study Goal" date and exam milestone date. |

- Existing documents remain nullable for both fields.
- RLS policies remain unchanged.

---

## 3. Types and Hooks

### 3.1. Types Update (`src/hooks/useDocuments.ts`)
The TypeScript interface for the document was updated to match the new schema:
```typescript
export interface Document {
    // ... existing fields ...
    deadline?: string | null;
    exam_date?: string | null;
}
```

### 3.2. Mutation Updates
- **File Upload logic**: Upload currently inserts `exam_date` from the selected "Study Goal (Completion Date)".
- **Update logic**: `useUpdateDocument` supports updates to `title`, `status`, `deadline`, and `exam_date`.

---

## 4. Frontend UI

### 4.1. File Upload Dialog (`src/components/files/FileUploadDialog.tsx`)
- Includes an optional native date input (`<input type="date">`) labeled **Study Goal (Completion Date)**.
- The selected value is saved as `exam_date` during upload.

### 4.2. File List View (`src/components/files/FilesContent.tsx`)
- Displays conditional badges for:
  - `deadline` -> `Due {date}`
  - `exam_date` -> `Exam {date}`

---

## 5. Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/012_add_deadline_to_documents.sql` | Adds the nullable `deadline` column to the `documents` table. |
| `supabase/migrations/016_add_exam_date_to_documents.sql` | Adds the nullable `exam_date` column to the `documents` table. |

## 6. Files Modified

| File | Change |
|------|--------|
| `src/hooks/useDocuments.ts` | Added `deadline` and `exam_date` to the `Document` type and update mutation support. |
| `src/components/files/FileUploadDialog.tsx` | Upload form now collects optional `goalDate` and saves it to `exam_date`. |
| `src/components/files/FilesContent.tsx` | Displays both `Due` (`deadline`) and `Exam` (`exam_date`) badges when available. |

---

## 7. Verification Checklist

- [ ] Open the Supabase dashboard and verify both `deadline` and `exam_date` columns exist on `documents`.
- [ ] Navigate to the Files page and click "Upload File".
- [ ] Verify the "Study Goal (Completion Date)" date input is visible and optional.
- [ ] Upload a file *without* selecting a goal date -> verify upload succeeds.
- [ ] Upload a file *with* a goal date -> verify row stores `exam_date`.
- [ ] Check the document list view -> verify `Exam [Date]` appears for that file.
- [ ] Set a `deadline` through deadline-aware flows -> verify `Due [Date]` appears.

With these pieces in place, document scheduling metadata is implemented and visible across upload/list workflows.
