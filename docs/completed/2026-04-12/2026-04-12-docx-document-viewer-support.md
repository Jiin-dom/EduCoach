# DOCX Document Viewer Support

- Date: 2026-04-12
- App affected: both
- Type of work: feature

## Summary of what was implemented

Extended the study-file viewing experience so `docx` files are no longer treated as download-only in the web app. The web document pane now detects `docx` files, fetches the same signed Supabase URL used for downloads, and renders an inline Microsoft Office preview while preserving the existing native PDF viewer.

## Problem being solved

Students could upload Word documents because the shared storage validation already accepted `docx`, but once those files were opened from the study viewer they only got metadata plus a download button. That created a mismatch between supported upload types and supported viewing types.

## Scope of changes

- Added a small document-preview helper to map file types to preview modes.
- Added a Vitest suite describing the `docx` preview URL contract.
- Updated the web document pane to branch between:
  - native PDF rendering for `pdf`
  - Office preview embedding for `docx`
  - download-only fallback for other file types

## Files/modules/screens/components/services affected

- `educoach/src/lib/documentPreview.ts`
- `educoach/src/lib/documentPreview.test.ts`
- `educoach/src/components/files/DocumentPane.tsx`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes:
  - none to the backend contract
  - the viewer now reuses the existing signed storage URL for `docx` preview embedding

## User-facing behavior changes

- Uploaded `docx` study materials can now be previewed inline in the web document pane.
- PDF viewing behavior is unchanged.
- `txt` and `md` files still use the existing download-only fallback.

## Developer notes or architectural decisions

- Reused the existing signed Supabase URL flow instead of introducing a backend document-conversion step.
- Used Microsoft Office Web Viewer for `docx` preview so the change stays in the UI layer and does not require new storage fields, edge functions, or schema changes.
- Checked the shared backend contract before implementation: both web and mobile already accept `docx` uploads via the same `file_type` model.

## Testing/verification performed

- Added a targeted Vitest file for the preview helper contract.
- Attempted to run `npm test -- src/lib/documentPreview.test.ts`, but this workspace’s local Node/WSL setup failed before test execution with:
  - `WSL 1 is not supported. Please upgrade to WSL 2 or above.`
  - `Could not determine Node.js install directory`
- Performed source-level verification that:
  - web upload validation still accepts `docx`
  - the document pane now branches on preview mode instead of hard-coding PDF-only behavior

## Known limitations

- `docx` preview depends on Microsoft Office Web Viewer and network access to that service.
- If the Office embed fails, users must fall back to opening the original signed file.
- Automated web verification could not be completed in this workspace because Node-based commands fail in the current WSL environment.

## Follow-up tasks or recommended next steps

- Re-run the new Vitest suite and a full web build in an environment where Node works normally.
- Consider adding first-class preview support for `txt` and `md` if those file types need in-app reading rather than download fallback.
