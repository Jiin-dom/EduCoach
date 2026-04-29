# Phase 3.9: UX Resilience & Error Handling Upgrade

**Status:** Implemented  
**Date:** March 7, 2026  
**Scope:** Race condition fix, processing overlay, user-friendly errors, responsive UI

## Problem Statement

After Phase 3.8 enriched the pipeline, several UX and reliability issues surfaced during real-world testing:

1. **False error after upload**: After a successful upload + processing, the file list showed "Error" with "Failed to send a request to the Edge Function" — but refreshing the page showed it was actually ready. A classic race condition between client and server.
2. **No processing feedback**: During document upload and NLP analysis (which can take 30-60+ seconds), the user saw only a tiny spinner with "Uploading..." and could still interact with the app, leading to confusion.
3. **Cryptic error messages**: When processing failed (e.g., image-heavy PDF), users saw raw technical messages like "Edge Function returned a non-2xx status code" or "Tika extraction failed: 500".
4. **Error message swallowing**: A bug in `extractWithNlpService` caused the real error (e.g., "Document appears to be empty") to be replaced with a generic "Could not connect to text extraction service."
5. **Long filenames broke the upload dialog**: The file selection card didn't truncate properly, pushing content outside the dialog boundaries.

## Changes Made

### 1. Race Condition Fix (`useDocuments.ts`)

**The bug**: When the Edge Function took longer than the client's HTTP timeout:
- Client received a timeout error from the Supabase SDK
- Client's error handler blindly wrote `status: 'error'` to the DB
- Edge Function was still running and eventually wrote `status: 'ready'`
- User saw "Error" until they manually refreshed

**The fix** — three-part defense:

**a) Smart error handler in `useProcessDocument`:**
Before setting `status: 'error'`, the mutation now re-checks the actual document status in the database:
- If status is already `'ready'` → Edge Function already completed, return success
- If status is `'processing'` → Edge Function still running, don't overwrite, let it finish
- If status is `'error'` with an `error_message` → Edge Function already set a friendly error, preserve it
- Only writes `status: 'error'` as a last resort when the Edge Function clearly never ran

**b) Cache invalidation on error:**
The `onError` callback now always calls `queryClient.invalidateQueries()` so the UI fetches the real DB state instead of showing stale optimistic data.

**c) Auto-polling for processing documents:**
Both `useDocuments` (list) and `useDocument` (single) hooks now use React Query's `refetchInterval`:
- When any document has `status: 'processing'`, the hook polls every 5 seconds
- When the Edge Function finishes and sets `status: 'ready'`, the UI updates automatically
- Polling stops automatically once no documents are processing

### 2. Full-Screen Processing Overlay (`FileUploadDialog.tsx`)

Replaced the generic "Uploading..." spinner with a rich, multi-phase progress UI:

**Pipeline steps displayed:**
1. **Uploading** (CloudUpload icon) — "Uploading your file to secure storage..."
2. **Saving** (Database icon) — "Saving document metadata..."
3. **Analyzing** (Brain icon) — Rotates through 7 messages every 4 seconds:
   - "Extracting text from your document..."
   - "Running NLP analysis on content..."
   - "Identifying key concepts and topics..."
   - "Building concept relationships..."
   - "Generating study flashcards..."
   - "Creating semantic embeddings..."
   - "Almost there, finalizing your study material..."

**Visual elements:**
- Each step shows: green checkmark (done), spinning loader (active), grayed icon (pending)
- Progress bar with "Step X of 3 — Do not close this window"
- Full-screen backdrop blur overlay (`z-[60]`) blocks all interaction behind the dialog

**Interaction blocking:**
- `onPointerDownOutside`, `onEscapeKeyDown`, `onInteractOutside` all prevented during processing
- Dialog close button hidden via CSS
- `handleOpenChange` returns early when `isBusy` is true

**Success state:**
- Sparkles icon with "Your study material is ready!"
- "Concepts, flashcards, and study guide have been generated."

### 3. Processing Overlay in FileViewer (`FileViewer.tsx`)

When a user navigates to a document that isn't `'ready'`, they see a prominent status card:

- **Processing**: Brain icon with spinner badge, "Analyzing Your Document" heading, "This page will update automatically" message, polling indicator
- **Pending**: Orange sparkles icon, "Document Pending Processing" heading, "Process Document" button
- **Error**: Alert icon, error message from DB, "Retry Processing" button

The study content (tabs, document pane) is dimmed to 30% opacity with `pointerEvents: 'none'` so the layout is visible but not interactive.

### 4. Error Message Swallowing Fix (`process-document/index.ts`)

**The bug**: In `extractWithNlpService`, the `catch` block was designed for network/connection errors, but it also caught intentional `throw` statements from inside its own `try` block:
```
try {
    if (!result.success) throw new Error('NLP_SERVICE_ERROR:Document is empty')  // <-- caught below
} catch {
    throw new Error('NLP_SERVICE_ERROR:Could not connect...')  // <-- swallows the real error
}
```

**The fix**: The `catch` block now checks if the error already carries an NLP error code prefix. If so, it re-throws as-is:
```
if (err.message.startsWith('NLP_SERVICE_ERROR:') || err.message.startsWith('NLP_SERVICE_TIMEOUT:')) {
    throw err  // Intentional error — pass through unchanged
}
```

### 5. User-Friendly Error Messages

**NLP Service (`main.py`):**

| Before | After |
|--------|-------|
| `"Tika extraction failed: 500"` | `"The document could not be read. It may be corrupted or in an unsupported format."` |
| `"Document appears to be empty or unreadable"` | `"Not enough readable text found in this document. It may contain mostly images, scanned pages, or non-text content. Try uploading a text-based version instead."` |
| `"Tika connection error: <exception>"` | `"The text extraction service is temporarily unavailable. Please try again in a few moments."` |
| Raw Python exception string | `"Something unexpected happened while analyzing your document. Please try again."` |

**Edge Function (`process-document/index.ts`):**

| Before | After |
|--------|-------|
| `"Failed to download file. <pg error>"` | `"We couldn't retrieve your file. Please try uploading it again."` |
| `"Failed to save document chunks. <pg error>"` | `"We couldn't save the processed content. Please try again."` |
| `"Failed to update document. <pg error>"` | `"We couldn't finalize your document. Please try processing again."` |
| `"Failed to extract text. Status: 500"` | `"The text analysis service encountered an error. Please try again."` |
| `"Could not connect to text extraction service."` | `"Could not reach the text extraction service. Please try again in a moment."` |

**Client-side (`useDocuments.ts`):**
- Extracts server-provided friendly message from `data.error` in the Edge Function response body
- Preserves the Edge Function's `error_message` already saved in the DB instead of overwriting with the Supabase SDK's generic "Edge Function returned a non-2xx status code"
- Falls back to "Something went wrong while processing your document. Please try again." only when no better message is available

**Frontend (`FilesContent.tsx`):**
- Error text color changed from aggressive red (`text-destructive`) to softer amber (`text-amber-600`) — less alarming for the user

### 6. Upload Dialog Responsiveness (`FileUploadDialog.tsx`)

Fixed long filenames breaking the selected file card layout:

- Added `overflow-hidden` on the outer flex container to give `truncate` a boundary to clip against
- Added `shrink-0` on the file icon and close button so flexbox doesn't squish them when the filename is long
- Added `text-sm` on the filename text for better proportion in the compact card

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useDocuments.ts` | Smart error handler, cache invalidation on error, auto-polling for processing state |
| `src/components/files/FileUploadDialog.tsx` | Full-screen overlay, multi-step progress, interaction blocking, responsive file card |
| `src/components/files/FileViewer.tsx` | Processing/pending/error overlay, dimmed content for non-ready documents |
| `src/components/files/FilesContent.tsx` | Amber error text instead of red |
| `supabase/functions/process-document/index.ts` | Error swallowing fix, all user-friendly error messages |
| `nlp-service/main.py` | All user-friendly error messages |

## Deployment

1. Rebuild NLP service: `docker compose build nlp-service && docker compose up -d`
2. Deploy Edge Function: `npx supabase functions deploy process-document --no-verify-jwt`
3. Frontend rebuilds automatically (Vite HMR or `npm run build`)
4. No database migration required — all changes are code-level
