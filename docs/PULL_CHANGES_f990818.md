# Pulled Changes Summary (`eed5112` -> `f990818`)

This document explains the updates that came in when you ran `git pull`.

## Short Summary

This pull introduces feature work focused on study workflow and account management. It adds optional document deadlines, in-view PDF highlighting with notes, and profile security/account actions (change password and delete account). It also streamlines quiz creation by allowing document selection directly from the Quizzes page.

## TL;DR

- Added **document deadlines** (DB migration + upload + display in Files/Dashboard).
- Added **PDF highlight + note annotations** in the document viewer (UI/state-based).
- Added **Change Password** and **Delete Account** dialogs in Profile.
- Improved quiz flow with a new **Select Document** dialog before generating quizzes.

## Source

- Remote: `origin/main`
- Before pull: `eed5112`
- After pull: `f990818`
- Main merge message: **"Added set deadline, Highlight, change password feature"**

## High-Level Summary

The pulled changes add three major user-facing features:

1. **Document deadline support** (database + upload form + file/dashboard display)
2. **PDF highlight + note annotations in the document viewer**
3. **Account security/profile enhancements** (change password and delete account dialogs)

It also improves the quiz generation flow by letting users choose a document directly from the Quizzes page.

## Detailed Changes by File

### 1) Deadline Support for Documents

#### `supabase/migrations/012_add_deadline_to_documents.sql`
- Added a new optional database column:
  - `documents.deadline TIMESTAMPTZ`

#### `src/hooks/useDocuments.ts`
- Updated the `Document` TypeScript interface:
  - Added optional `deadline?: string | null`

#### `src/components/files/FileUploadDialog.tsx`
- Added deadline input state and reset behavior.
- Added a new **"Deadline (Optional)"** date input in the upload form.
- Included `deadline` when inserting new document records into Supabase.

#### `src/components/files/FilesContent.tsx`
- File cards/list now display a due date when `file.deadline` exists:
  - `Due {date}`

#### `src/components/dashboard/DashboardContent.tsx`
- Dashboard recent file items now show due date when available.

### 2) PDF Highlight + Note Annotations

#### `src/types/annotations.ts` (new file)
- Added `Annotation` type definition with:
  - selected text
  - note
  - color
  - page number
  - rectangle coordinates
  - timestamp

#### `src/components/files/DocumentPane.tsx`
- Added edit/annotation mode with new UI controls (`Edit2`, `Highlighter` icons).
- Captures text selection on mouse-up while in edit mode.
- Computes relative selection rectangles to keep highlights aligned on the PDF page.
- Added floating toolbar for:
  - highlight color selection
  - optional note input
  - save annotation action
- Renders saved highlight overlays per page.
- Added cleanup behavior when edit mode is toggled off.

### 3) Profile Security and Account Actions

#### `src/components/profile/ProfileContent.tsx`
- Added Change Password dialog UI and logic:
  - current/new/confirm password fields
  - client-side validation
  - verify current password via `supabase.auth.signInWithPassword`
  - update password via `supabase.auth.updateUser`
  - loading, success, and error states
  - password visibility toggle (`Eye`/`EyeOff`)
- Added Delete Account confirmation dialog:
  - calls `supabase.rpc('delete_user')`
  - signs user out on success (`signOut`)
  - redirects to `/` after successful deletion

### 4) Quiz Flow Improvements

#### `src/components/quizzes/SelectDocumentDialog.tsx` (new file)
- New dialog for selecting a processed (`ready`) document before quiz generation.
- Includes search/filter support and loading/error/empty states.

#### `src/components/quizzes/QuizzesContent.tsx`
- Replaced direct navigation to `/files` for quiz generation with in-page flow:
  - open `SelectDocumentDialog`
  - choose a document
  - open `GenerateQuizDialog` for selected document
- Applied this flow in both top action area and empty-state CTA.

### 5) Minor Cleanup

#### `src/components/files/FileViewer.tsx`
- Small formatting/whitespace-only adjustment (no behavior change).

## Diff Size

- **11 files changed**
- **687 insertions**, **30 deletions**
- **3 new files added**:
  - `src/components/quizzes/SelectDocumentDialog.tsx`
  - `src/types/annotations.ts`
  - `supabase/migrations/012_add_deadline_to_documents.sql`

## Notes

- The migration file adds the `deadline` column, but it still needs to be applied in your target database environment if not yet run there.
- Annotation data in this change is currently managed in component state (`DocumentPane`) and is not persisted to backend in this diff.
