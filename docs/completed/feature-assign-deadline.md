## Feature: Assign Deadline (Completed)

This document summarizes what was implemented for the Assign Deadline feature, allowing users to attach an optional target deadline date to their uploaded study materials, which helps them track when they need to finish studying a specific document.

---

## 1. High-Level Overview

- **Goal**: Enhance the document management system by allowing users to set, view, and manage study deadlines for their uploaded materials.
- **Architecture**:
  - **Database**: Added a `deadline` column to the `documents` table via a Supabase migration.
  - **Types/Hooks**: Updated the frontend `Document` interface and Supabase insert/update hooks to support the new field.
  - **Frontend UI**: Added a date picker to the file upload dialog and displayed the deadline on the document list view.

---

## 2. Database Schema (Migration `012_add_deadline_to_documents.sql`)

A new migration was created to alter the existing `documents` table.

| Column | Type | Notes |
|--------|------|-------|
| `deadline` | `TIMESTAMPTZ` (nullable) | Optional target date for studying the document. Default is NULL. |

- Existing documents automatically have a `NULL` deadline.
- RLS policies remain unchanged as they naturally inherited access control from the parent `documents` table design.

---

## 3. Types and Hooks

### 3.1. Types Update (`src/hooks/useDocuments.ts`)
The TypeScript interface for the document was updated to match the new schema:
```typescript
export interface Document {
    // ... existing fields ...
    deadline?: string | null;
}
```

### 3.2. Mutation Updates
- **File Upload logic**: When inserting a new document into the database after storage upload, the `deadline` is now passed in the payload if the user selected one.
- **Update Logic**: The `useUpdateDocument` hook inherently supports updating the deadline since it takes a `Partial<Document>`.

---

## 4. Frontend UI

### 4.1. File Upload Dialog (`src/components/files/FileUploadDialog.tsx`)
- Integrated a **Date Picker** component (using `react-day-picker` via Shadcn UI Calendar/Popover components).
- Made the field optional—users can clear the date or skip it entirely.
- Added visual feedback for the selected date.

### 4.2. File List View (`src/components/files/FilesContent.tsx`)
- Updated the document card to display the assigned deadline alongside existing metadata (file size, upload date).
- The deadline is formatted to a human-readable date string (e.g., `Due MM/DD/YYYY`).
- Added conditional rendering: the "Due date" text only appears if a deadline was actually set.

---

## 5. Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/012_add_deadline_to_documents.sql` | Adds the nullable `deadline` column to the `documents` table. |

## 6. Files Modified

| File | Change |
|------|--------|
| `src/hooks/useDocuments.ts` | Added `deadline` to the `Document` type definition. |
| `src/components/files/FileUploadDialog.tsx` | Added state and UI for selecting an optional deadline during upload. |
| `src/components/files/FilesContent.tsx` | Added UI to display the deadline on the document cards in the list view. |

---

## 7. Verification Checklist

- [ ] Open the Supabase dashboard and verify the `deadline` column exists on the `documents` table.
- [ ] Navigate to the Files page and click "Upload File".
- [ ] Verify the new Date Picker is visible and interactable.
- [ ] Upload a file *without* selecting a deadline → Verify upload succeeds and no deadline is shown in the list.
- [ ] Upload another file *with* a selected deadline → Verify upload succeeds.
- [ ] Check the document list view → Verify the new file displays the correct "Due [Date]" badge.
- [ ] Check the Supabase dashboard → Verify the row was created with the correct timestamp in the `deadline` column.

With these pieces in place, the **Assign Deadline** feature is fully implemented, allowing users to prioritize their study schedule.
