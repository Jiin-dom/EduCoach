# Web Registration Password Checklist

Date: 2026-04-18

App affected: educoach

Type of work: UI, fix

## Summary of what was implemented

Updated the web registration form to show password requirements as a themed checklist instead of a comma-separated validation message. The checklist reads from the same shared password validation rules used during form submission.

## Problem being solved

The web registration screen surfaced password requirements as a single text error string, which was harder to scan and less helpful while the user was typing. The requested behavior was a more visual checklist that still fits the EduCoach design system.

## Scope of changes

- Added reusable password requirement checklist metadata in web auth validation
- Rendered checklist rows in the web registration form
- Added contract coverage for the shared helper export and checklist rendering

## Files/modules/screens/components/services affected

- `educoach/src/lib/authValidation.ts`
- `educoach/src/components/forms/RegisterForm.tsx`
- `educoach/scripts/register_password_checklist_contract_test.py`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

- The web registration password field now shows a live checklist of requirements instead of a joined error string.
- Each requirement row updates while the user types and stays aligned with the EduCoach theme.

## Developer notes or architectural decisions

- Kept the submission validator as the source of truth and derived the checklist UI from exported requirement metadata to prevent drift between UI hints and actual enforcement.
- Left form submission behavior and password rules unchanged.

## Testing/verification performed

- `python3 scripts/register_password_checklist_contract_test.py`
  - Result: passed

## Known limitations

- Full web TypeScript/build verification was not run from this shell because Node/npm execution is blocked by the local WSL environment.

## Follow-up tasks or recommended next steps

- Re-run the web build or TypeScript checks from a shell with a working Node installation.
- Manually confirm the checklist styling on the web registration page across desktop and mobile breakpoints.
