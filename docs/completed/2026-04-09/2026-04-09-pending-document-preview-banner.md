# Pending Document Preview Banner

## Date
2026-04-09

## App affected
`educoach`

## Type of work
UI

## Summary of what was implemented
Reworked the pending-document experience on the file detail page so pending documents no longer use a blocking centered card that disables the whole layout. Pending files now show a non-blocking banner, and the original document can be previewed before processing starts.

## Problem being solved
The previous pending state prevented users from browsing the uploaded PDF/document while the file was still unprocessed. That conflicted with the new upload-first flow, where reviewing the uploaded file before starting processing is useful.

## Scope of changes
- Removed the blocking pending-state card from the file detail experience.
- Added a non-blocking pending banner with a processing CTA.
- Kept the document pane accessible while the document is still pending.
- Enabled the mobile document toggle before processing so mobile users can preview pending files.
- Left the processing-state block in place while active analysis is running.

## Files/modules/screens/components/services affected
- `educoach/src/components/files/FileViewer.tsx`

## Supabase impact
- **schema changes**: None
- **policy changes**: None
- **auth changes**: None
- **storage changes**: None
- **API/query changes**: None

## User-facing behavior changes
- Pending documents now show a banner instead of a blocking placeholder card.
- Users can browse the uploaded source document before processing starts.
- On mobile, the document viewer toggle is available before processing.
- Processing still shows a blocked state while active analysis is running.

## Developer notes or architectural decisions
- This change intentionally targets only the `pending` experience.
- The `processing` state still blocks the two-pane layout to preserve the existing “analysis in progress” behavior.
- Existing tab-level empty states remain the source of truth for explaining why guide/concepts/flashcards content is unavailable before processing.

## Testing/verification performed
- Performed static code-path review of the file-detail state handling in `FileViewer.tsx`.
- Cross-checked that tab components already render appropriate placeholders when the document is not `ready`.
- Automated runtime verification was not completed because the current shell cannot execute the project’s Node-based test/build commands successfully.

## Known limitations
- Processing still uses the blocking overlay behavior.
- This change does not redesign tab-level empty-state messaging beyond making the document pane accessible.

## Follow-up tasks or recommended next steps
- Manually verify desktop and mobile pending-document flows in a working local runtime.
- Consider whether the `processing` state should also allow document preview in a later UX pass.
