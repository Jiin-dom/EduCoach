# Document Processing Loading Overlay

## Date

2026-04-30

## App affected

educoach

## Type of work

UI

## Summary of what was implemented

Added a reusable document processing loading overlay for long-running document processing actions. The overlay now appears when a user uploads a single document that starts automatic processing, manually processes a document from the Files page, or manually processes a document from the file detail/content page. The overlay cards now update interactively as work advances.

## Problem being solved

Manual document processing only showed a small spinner inside the clicked button. Single-document upload processing also lacked a clear page-level message explaining that upload and AI processing were both in progress.

## Scope of changes

- Added a testable helper for overlay copy.
- Added tested helper logic for overlay step states.
- Added a reusable `DocumentProcessingOverlay` component.
- Wired the overlay into single-file upload processing.
- Wired the overlay into manual processing from the Files page.
- Wired the overlay into manual processing from the File Detail page.
- Preserved existing button spinners and disabled states as secondary feedback.
- Added visible active, complete, and finalizing states for overlay step cards.

## Files/modules/screens/components/services affected

- `src/lib/documentProcessingOverlay.ts`
- `src/lib/documentProcessingOverlay.test.ts`
- `src/components/files/DocumentProcessingOverlay.tsx`
- `src/components/files/FileUploadDialog.tsx`
- `src/components/files/FilesContent.tsx`
- `src/components/files/FileViewer.tsx`
- `src/components/files/StudyHeader.tsx`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

This is a web-only UI feedback change. The existing Supabase upload, insert, processing mutation, and cache invalidation behavior were left unchanged, so there is no backend contract change for `educoach-mobile`.

## User-facing behavior changes

- Single-file upload processing now shows a full-page overlay with a message telling the user to keep the page open while EduCoach uploads and processes the document.
- During single-file upload, the Upload card starts active, then changes to a check mark once the uploaded document record is ready and processing begins.
- Manual processing from the Files page now shows a full-page overlay with the document title and a processing message.
- Manual processing from the file detail/content page now shows a full-page overlay while the guide, concepts, flashcards, and notes are being prepared.
- Manual processing shows Read as complete, Analyze as active, and briefly shows Prepare as active after successful processing before closing.

## Developer notes or architectural decisions

The overlay message copy and step-state mapping live in `src/lib/documentProcessingOverlay.ts` so they can be verified with the current node-based Vitest setup. The React overlay component consumes that helper and stays presentational.

## Testing/verification performed

- `npm test -- src/lib/documentProcessingOverlay.test.ts`
- `npm run build`

Build completed successfully. Vite reported the existing large chunk warning for the main bundle.

## Known limitations

The overlay does not show fine-grained backend progress percentages because the current processing API does not expose step-level progress.

## Follow-up tasks or recommended next steps

If the processing Edge Function later exposes progress events or persisted processing steps, connect the overlay step labels to real progress rather than static status text.
