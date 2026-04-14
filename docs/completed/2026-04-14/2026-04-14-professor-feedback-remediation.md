# Professor Feedback Remediation

- Date: 2026-04-14
- App affected: educoach, educoach-mobile (types only)
- Type of work: feature, fix, refactor

## Summary of what was implemented

A 9-phase remediation addressing professor feedback on database normalization, auth validation, fabricated analytics, overclaimed readiness metrics, learning path clarity, and goal model surfacing.

### Phase 1 — Fix Registration Data Model (Normalization)

- Added `first_name` and `last_name` columns to `user_profiles` via migration 029.
- Backfill logic splits existing `display_name` on first space.
- Updated `handle_new_user` trigger (based on migration 021) to read `raw_user_meta_data` fields atomically during signup.
- Replaced the single "Full Name" registration field with separate "First Name" and "Last Name" inputs.
- Updated `AuthContext.signUp` to pass name metadata via `options.data` for atomic profile creation.
- Updated `ProfilingForm` to pre-populate display name from `first_name`.
- Updated `ProfileContent` with three separately editable name fields (First, Last, Display).
- Updated admin edge function `create_user` to accept `firstName`/`lastName` and pass `user_metadata`.
- Updated `useAdminUsers` hook and `AddUserModal` form to match the new shape.
- Updated mobile `UserProfile` type to include `first_name` and `last_name`.

### Phase 2 — Strengthen Auth Validation

- Created shared `authValidation.ts` module with `validateEmail`, `validatePassword`, and `validateName`.
- Applied to `RegisterForm`, `LoginForm`, `ProfileContent` (password change), and `AddUserModal` with inline per-field error messages.
- Documented `enable_confirmations = false` as intentional classroom policy in `supabase/config.toml`.

### Phase 3 — Fix Fabricated Metrics and Processing Copy

- Replaced the fabricated `masteryDelta = conceptsWithCorrect.size * 2` in `useLearningProgress.ts` with a real before/after comparison using `mastery_snapshots`.
- Updated `FileUploadDialog` and `FilesContent` copy to explain single-auto vs batch-deferred processing.

### Phase 4 — Empty State Onboarding

- Replaced the generic empty learning path card with a 4-step onboarding checklist (upload, process, quiz, target) with progress bar and action links.

### Phase 5 — Rename Readiness to Preparation Estimate

- Renamed all UI-visible "Readiness" labels to "Preparation Estimate" across 6 locations: `ReadinessScoreCard`, `StudyGoalsPanel`, `LearningPathContent`, `ProfileContent`, `LandingPage`.
- Changed level labels from High/Medium/Low to Strong/Moderate/Limited.
- Renamed `ReadinessLevel` type to `PreparationLevel`, `getReadinessLevel` to `getPreparationLevel`, `getReadinessColor` to `getPreparationColor`.

### Phase 6 — Make Preparation Estimate Defensible

- Created `readinessEstimate.ts` with a transparent coverage + performance model.
- Threshold logic: `<25% coverage → "Not enough data"`, `≥60% coverage + ≥80% performance → "Strong"`, `≥40% + ≥60% → "Moderate"`, otherwise `"Limited"`.
- Updated `ReadinessScoreCard` to show coverage % and performance % as two separate visible stats.
- Updated `LearningPathContent` overall estimate to show both metrics with progress bars.
- Updated `StudyGoalsPanel` per-document estimate to penalize low coverage.

### Phase 7 — Strengthen Mastery and Learning Path Copy

- Added mastery explanatory info banner to the learning path page.
- Added `last_reviewed_at` to the analytics `ConceptDrillDown` component.
- Added "Based on your performance" badge to all LP performance section headers.
- Added derivable milestone badges: "First quiz taken" and "First concept mastered."

### Phase 8 — Goal Model Decision Gate

- Created `studyGoals.ts` types and `useStudyGoals.ts` read-only hook.
- Added read-only surfacing of existing `study_goals` rows in `StudyGoalsPanel`.
- No CRUD operations — read-only phase only.

### Phase 9 — Prerequisite Ordering (Research Track)

- Documented as future research. No code shipped. Must not leak into implementation scope.

## Problem being solved

The professor raised 8 concerns about the app's data model, validation, metrics defensibility, and feature labeling. Key issues: the registration form dropped the name on signup and the schema had no normalized name fields; login allowed immediate access with minimal validation; "Readiness" was overclaimed (just `averageMastery`); one analytics metric (`masteryDelta`) was fabricated; the learning path empty state was a dead end; and the goal model was dormant.

## Scope of changes

- 1 new SQL migration
- 4 new TypeScript/library files
- 17+ existing files modified across web, mobile, and Supabase edge functions
- 1 config file documented
- UI copy updated in 5+ components

## Files/modules/screens/components/services affected

### New files
- `educoach/supabase/migrations/029_first_last_name.sql`
- `educoach/src/lib/authValidation.ts`
- `educoach/src/lib/readinessEstimate.ts`
- `educoach/src/hooks/useStudyGoals.ts`
- `educoach/src/types/studyGoals.ts`

### Modified files
- `educoach/src/contexts/AuthContext.tsx` — UserProfile type, signUp signature
- `educoach/src/components/forms/RegisterForm.tsx` — first/last name fields, validation
- `educoach/src/components/forms/LoginForm.tsx` — email validation
- `educoach/src/components/forms/ProfilingForm.tsx` — pre-populate from first_name
- `educoach/src/components/profile/ProfileContent.tsx` — 3 name fields, password validation, rename
- `educoach/src/components/admin/AddUserModal.tsx` — first/last name, validation
- `educoach/src/hooks/useAdminUsers.ts` — firstName/lastName in create input
- `educoach/supabase/functions/admin-user-management/index.ts` — user_metadata path
- `educoach/src/hooks/useLearningProgress.ts` — real masteryDelta from snapshots
- `educoach/src/components/files/FileUploadDialog.tsx` — processing copy
- `educoach/src/components/files/FilesContent.tsx` — processing copy
- `educoach/src/components/dashboard/ReadinessScoreCard.tsx` — preparation estimate with coverage/performance
- `educoach/src/components/learning-path/StudyGoalsPanel.tsx` — rename, preparation model, study goals surfacing
- `educoach/src/components/learning-path/LearningPathContent.tsx` — onboarding checklist, preparation estimate, mastery copy, milestones, performance badges
- `educoach/src/components/analytics/AnalyticsContent.tsx` — last_reviewed_at in drill-down
- `educoach/src/pages/LandingPage.tsx` — marketing copy rename
- `educoach/supabase/config.toml` — documentation comment
- `educoach-mobile/src/types/index.ts` — first_name, last_name on UserProfile

## Supabase impact

- Schema changes: `first_name TEXT`, `last_name TEXT` added to `user_profiles`; `handle_new_user` trigger updated to read `raw_user_meta_data`
- Policy changes: none (existing RLS policies cover new columns)
- Auth changes: signup now passes metadata via `options.data`; admin `createUser` passes `user_metadata`
- Storage changes: none
- API/query changes: admin edge function `create_user` accepts `firstName`/`lastName` instead of `displayName`

## User-facing behavior changes

- Registration form collects First Name and Last Name separately with inline validation
- Login form validates email format before attempting sign-in
- Password change requires 8+ chars with uppercase, lowercase, number, and special character
- Admin add-user collects first/last name with validation
- Profile page shows three editable name fields
- Dashboard "Readiness" card renamed to "Preparation Estimate" showing coverage % and performance %
- All "Readiness" labels renamed to "Preparation Estimate" with Strong/Moderate/Limited levels
- Learning path empty state shows a 4-step onboarding checklist
- Learning path sections show "Based on your performance" badges
- Mastery explanation banner appears on the learning path page
- Milestone badges appear for first quiz taken and first concept mastered
- Overall preparation shows transparent coverage and performance breakdown
- StudyGoalsPanel shows existing study_goals if any exist (read-only)
- File upload/processing copy clarified for single vs bulk workflows
- Weekly progress `masteryDelta` now reflects real before/after snapshot data

## Developer notes or architectural decisions

- `display_name` is kept as a persisted column, NOT computed from first/last name. Users can set a nickname independently.
- The `handle_new_user` trigger is based on migration 021 (not 001) because 021 replaced the trigger to also create a subscription row.
- `options.data` on client `signUp` maps to `raw_user_meta_data` in the trigger. `user_metadata` on admin `createUser` maps to the same field.
- The preparation estimate intentionally avoids arbitrary weighted formulas. Coverage and performance are shown separately with simple threshold logic.
- `masteryDelta` uses `mastery_snapshots` which are already written by `recomputeConceptMastery` on every quiz/flashcard flow. No new write infrastructure was needed.
- `useStudyGoals` is read-only in this remediation. CRUD comes in a future phase after confirming the goal model complements document-based scheduling.
- Phase 9 (prerequisite ordering) is explicitly deferred as research-only.

## Testing/verification performed

- `npx tsc --noEmit` passes with exit code 0 for the web app
- Mobile type changes verified — pre-existing errors in mobile are unrelated to this work
- No linter errors introduced in any modified file

## Known limitations

- The preparation estimate uses `totalConcepts` from `user_concept_mastery` (tracked concepts), not the total concepts in the `concepts` table across all documents. True document-level coverage would need a separate query.
- `useStudyGoals` is read-only — no create/edit/delete UI yet.
- Prerequisite ordering is not implemented. `related_concepts` in the concepts table captures undirected similarity, not directed prerequisites.
- Email confirmation remains disabled. Documented as intentional but would need enabling for production.
- The "difficulty mix" metric mentioned in Phase 7 is gated behind implementation — raw data exists in `question_attempt_log.question_difficulty` but no per-concept aggregation query was built in this remediation.

## Follow-up tasks or recommended next steps

- Run migration 029 against the live Supabase instance
- Test registration end-to-end (signup → trigger → profile creation with all three name fields)
- Build CRUD for `study_goals` (Phase 8 continuation)
- Wire `study_goals.target_value` into the preparation estimate as the benchmark
- Prototype prerequisite inference offline (Phase 9) and evaluate quality before any schema commitment
- Consider adding per-concept difficulty breakdown query for the analytics drill-down
