# Definition of Terms Codebase Cross-Check

Date: 2026-04-20

App affected: educoach

Type of work: refactor

## Summary of what was implemented

Cross-checked the EduCoach definition of terms document against the implementation areas for user profiling and core data, document processing, quiz generation and attempts, learning intelligence and analytics, and EduBuddy. Updated the definition file with missing implementation-backed terms and refined several existing terms whose wording was broader than the current code behavior.

## Problem being solved

The manuscript terminology covered the major algorithms but was missing several system objects and runtime mechanisms that appear directly in the codebase, including Supabase security, Edge Functions, React Query hooks, profile preferences, document records, quiz records, vector indexing, and study-goal records.

## Scope of changes

- Refined definitions for Learning Analytics Dashboard, Exam Readiness Indicator, Consistency Score, Learning Insights, Readiness Forecast, AI Recommendations, and Achievement Badge.
- Added new definitions for core data, document processing records, quiz records, learning configuration, and EduBuddy retrieval infrastructure.
- Preserved the existing definition-list format and continued numbering.

## Files/modules/screens/components/services affected

- `Docs/info/educoach-definition-of-terms.md`

## Supabase impact

- Schema changes: none
- Policy changes: none
- Auth changes: none
- Storage changes: none
- API/query changes: none

## User-facing behavior changes

No application behavior changed. This update only improves manuscript and project documentation accuracy.

## Developer notes or architectural decisions

The added terms were based on implemented tables, hooks, Edge Functions, migrations, and client-side logic rather than planned or generic terminology.

## Testing/verification performed

- Reviewed current definition terms before editing.
- Cross-checked terminology against phase documentation and implementation files for profiles, documents, quizzes, learning analytics, and EduBuddy.
- Verified the final definition numbering continues through item 109.

## Known limitations

Some older terms remain conceptual at the manuscript level but were refined to avoid overstating unsupported standalone systems.

## Follow-up tasks or recommended next steps

If the manuscript needs formal chapters for each pipeline, create separate pipeline documentation so the definition list remains concise.
