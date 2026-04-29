# Definition of Terms Pipeline Update

Date: 2026-04-20

App affected: educoach

Type of work: refactor

## Summary of what was implemented

Updated the EduCoach definition of terms manuscript file with implementation-specific terms from the learning path, analytics, and EduBuddy pipelines. Refined the existing RAG and AI Study Assistant Chat definitions to match the current user-scoped vector retrieval and grounded prompt flow.

## Problem being solved

The manuscript definitions needed additional system-specific terms for the newer learning path, analytics, and EduBuddy behavior. Some existing AI tutor wording was accurate at a high level but did not describe the actual retrieval, prompt, and citation flow clearly enough.

## Scope of changes

- Added new numbered definitions for learning-path scheduling, adaptive study tasks, analytics outputs, and EduBuddy traceability.
- Continued the existing numbering and paragraph spacing style.
- Avoided creating a duplicate definition file.

## Files/modules/screens/components/services affected

- `Docs/info/educoach-definition-of-terms.md`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

No application behavior changed. This was a documentation-only update for the manuscript reference material.

## Developer notes or architectural decisions

The new terms were aligned with the observed implementation of `user_concept_mastery`, `adaptive_study_tasks`, `question_attempt_log`, `mastery_snapshots`, and the `ai-tutor` Edge Function.

## Testing/verification performed

- Reviewed the updated Markdown spacing and numbering.
- Verified that the file now continues from item 59 through item 83.
- Checked that the update did not introduce a second competing definition file.

## Known limitations

The document remains a manuscript definition list only; it does not include full pipeline walkthroughs.

## Follow-up tasks or recommended next steps

If the manuscript requires a separate pipeline appendix, create a dedicated pipeline description document instead of overloading the definition of terms file.
