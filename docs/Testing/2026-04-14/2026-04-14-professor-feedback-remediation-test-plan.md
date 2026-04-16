# Professor Feedback Remediation Test Plan

- Date: 2026-04-14
- Feature area: Registration normalization, auth validation, analytics fix, preparation estimate, learning path onboarding, goal surfacing
- Completed doc: `educoach/docs/completed/2026-04-14/2026-04-14-professor-feedback-remediation.md`

## Cross-checked scope

This plan covers all files created or modified in the remediation:

- `educoach/supabase/migrations/029_first_last_name.sql`
- `educoach/src/contexts/AuthContext.tsx`
- `educoach/src/components/forms/RegisterForm.tsx`
- `educoach/src/components/forms/LoginForm.tsx`
- `educoach/src/components/forms/ProfilingForm.tsx`
- `educoach/src/components/profile/ProfileContent.tsx`
- `educoach/src/components/admin/AddUserModal.tsx`
- `educoach/src/hooks/useAdminUsers.ts`
- `educoach/supabase/functions/admin-user-management/index.ts`
- `educoach/src/lib/authValidation.ts`
- `educoach/src/lib/readinessEstimate.ts`
- `educoach/src/hooks/useLearningProgress.ts`
- `educoach/src/hooks/useStudyGoals.ts`
- `educoach/src/types/studyGoals.ts`
- `educoach/src/components/files/FileUploadDialog.tsx`
- `educoach/src/components/files/FilesContent.tsx`
- `educoach/src/components/dashboard/ReadinessScoreCard.tsx`
- `educoach/src/components/learning-path/StudyGoalsPanel.tsx`
- `educoach/src/components/learning-path/LearningPathContent.tsx`
- `educoach/src/components/analytics/AnalyticsContent.tsx`
- `educoach/src/pages/LandingPage.tsx`
- `educoach/supabase/config.toml`
- `educoach-mobile/src/types/index.ts`

---

## Phase 1: Registration Data Model

### 1.1 Migration backfill

- Run migration 029 against a database with existing users.
- Expected:
  - User with `display_name = "Jane Doe"` → `first_name = "Jane"`, `last_name = "Doe"`, `display_name = "Jane Doe"` (unchanged)
  - User with `display_name = "Prince"` → `first_name = "Prince"`, `last_name = NULL`, `display_name = "Prince"` (unchanged)
  - User with `display_name = NULL` → all three fields remain NULL

### 1.2 Registration form fields

- Open `/register`.
- Expected:
  - Two separate fields: "First Name" and "Last Name" (no "Full Name" field)
  - Both fields are required
  - Tab order flows: email → first name → last name → password → confirm

### 1.3 Atomic signup via trigger

- Register a new user with first name "Maria" and last name "Santos".
- Expected:
  - `user_profiles` row created with `first_name = 'Maria'`, `last_name = 'Santos'`, `display_name = 'Maria Santos'`
  - Profile exists immediately — no null-profile window
  - Navigates to `/profiling` after signup

### 1.4 Profiling pre-population

- After registering as "Maria Santos", land on the profiling form.
- Expected:
  - Step 1 shows "Display Name" field pre-populated with "Maria"
  - User can change it to a nickname (e.g., "Ria") without affecting first/last name
  - After completing profiling, `display_name = 'Ria'`, `first_name = 'Maria'`, `last_name = 'Santos'`

### 1.5 Profile editing (three fields)

- Open `/profile` (or settings page).
- Expected:
  - Three editable fields: First Name, Last Name, Display Name (Nickname)
  - Changing first name does NOT erase the display name
  - Changing display name does NOT overwrite first/last name
  - Save button detects changes to any of the three fields

### 1.6 Admin user creation

- Log in as admin. Open add-user modal.
- Expected:
  - Form shows "First Name" and "Last Name" fields (no "Full Name")
  - Created user has `first_name`, `last_name`, and derived `display_name` in their profile

### 1.7 Mobile type compatibility

- Run `npx tsc --noEmit` in `educoach-mobile`.
- Expected:
  - No new errors from `UserProfile` type changes
  - Pre-existing errors are unrelated to `first_name`/`last_name`

---

## Phase 2: Auth Validation

### 2.1 Register form validation

- Attempt to register with:
  - Empty first name → inline error "First name is required"
  - Single-character last name → inline error "Last name must be at least 2 characters"
  - Invalid email "notanemail" → inline error "Please enter a valid email address"
  - Password "abc" → inline error listing missing requirements (uppercase, number, special char, length)
  - Mismatched confirm password → inline error "Passwords do not match"
- Expected: per-field inline errors appear below each input. Form does not submit.

### 2.2 Register form with valid data

- Fill all fields correctly (e.g., first: "Juan", last: "Cruz", email: valid, password: "Test@123!", confirm matches).
- Expected: form submits, user is created, redirect to `/profiling`.

### 2.3 Login form validation

- Attempt to log in with:
  - Empty email → inline error "Email is required"
  - Invalid email "bad@" → inline error "Please enter a valid email address"
- Expected: form does not call `signIn`. Error appears below email field.
- Note: password complexity is NOT checked on login (user may have legacy password).

### 2.4 Profile password change validation

- Open profile page. Click "Change Password".
- Enter a weak new password (e.g., "password").
- Expected: error message listing missing requirements (uppercase, number, special character).

### 2.5 Admin add-user validation

- Open admin add-user modal.
- Submit with empty fields or weak password.
- Expected: per-field inline errors for first name, last name, email, and password.

### 2.6 Email confirmation policy

- Open `educoach/supabase/config.toml`.
- Expected: comment above `enable_confirmations = false` explains it is intentionally disabled for classroom demo.

---

## Phase 3: Analytics Fix and Processing Copy

### 3.1 Real masteryDelta

- As a user with quiz history spanning more than 7 days, open the learning path page.
- Expected:
  - Weekly progress `masteryDelta` reflects a real before/after comparison
  - If no comparable data exists (new user or no snapshots before this week), `masteryDelta = 0`
  - No inflated numbers (the old `conceptsWithCorrect.size * 2` formula is gone)

### 3.2 MasteryDelta edge case — new user

- Register a new user. Take one quiz.
- Expected:
  - `masteryDelta = 0` because there is no "before" baseline
  - `newConceptsTracked` shows the correct count
  - No error or crash

### 3.3 File upload copy — single file

- Upload a single file via the upload dialog.
- Expected:
  - Dialog description says "Upload one file to start processing automatically..."
  - After upload, status shows processing started (not "pending")

### 3.4 File upload copy — multiple files

- Upload 3+ files at once.
- Expected:
  - Dialog description mentions "Uploading multiple files adds them as pending"
  - After upload, completion message mentions "Head to the Files page and click Process All when ready"

### 3.5 Files page pending card copy

- Navigate to `/files` with pending documents.
- Expected:
  - Subtitle reads "Single files process automatically. Bulk uploads are queued — click Process All when ready."
  - Pending card description mentions "queued to prevent system overload"

---

## Phase 4: Empty State Onboarding

### 4.1 Onboarding checklist — new user

- Register a new user. Navigate to the learning path page.
- Expected:
  - 4-step checklist with progress bar ("0 of 4 steps completed")
  - Steps: Upload study materials, Process your documents, Take your first quiz, Set a study target date
  - Each incomplete step has a "Go" action button linking to the correct page

### 4.2 Onboarding checklist — partial progress

- Upload and process one document (but no quiz taken, no target set).
- Expected:
  - "2 of 4 steps completed" with progress bar at 50%
  - Upload and Process steps show checkmarks with strikethrough text
  - Quiz and Target steps show action buttons

### 4.3 Onboarding checklist — all complete

- Upload, process, take a quiz, set an exam date on a document.
- Expected:
  - Learning path shows the full learning path content (not the checklist)
  - Checklist is replaced by mastery sections and study plan

---

## Phase 5: Rename Readiness to Preparation Estimate

### 5.1 Dashboard card

- Open `/dashboard`.
- Expected:
  - Card title is "Preparation Estimate" (not "Readiness")
  - Level labels are "Strong", "Moderate", or "Limited" (not "High", "Medium", "Low")

### 5.2 Learning path overall estimate

- Open the learning path page with quiz history.
- Expected:
  - Card header reads "Overall Preparation Estimate"
  - Description references quiz and flashcard performance

### 5.3 Study goals panel

- Open the study goals/deadlines page.
- Expected:
  - Goal card badges read "Strong Preparation", "Moderate Preparation", or "Limited Preparation"
  - Progress bar label reads "Preparation Estimate" (not "Goal Readiness")

### 5.4 Profile insights

- Open the profile page.
- Expected:
  - Insight label reads "Preparation Estimate" (not "Readiness Score")

### 5.5 Landing page

- Open the landing page (logged out).
- Expected:
  - Marketing copy references "preparation" or "preparation estimate" (not "readiness")
  - Mock stat card reads "Preparation Estimate" with "78%"

---

## Phase 6: Defensible Preparation Estimate

### 6.1 Low-coverage user

- User has attempted 3 concepts out of 50 total tracked.
- Expected:
  - Dashboard card shows "Not enough data" (not "Strong" or "Moderate")
  - Coverage shows a low percentage, performance may be high but label is conservative

### 6.2 High-coverage, high-performance user

- User has attempted 40+ of 50 concepts with average mastery ≥ 80%.
- Expected:
  - Label shows "Strong"
  - Coverage ≥ 60%, Performance ≥ 80% shown separately

### 6.3 Medium-coverage, medium-performance user

- User has attempted ~25 of 50 concepts with average mastery ~65%.
- Expected:
  - Label shows "Moderate"

### 6.4 Coverage and performance visible

- Open `/dashboard` as any user with quiz history.
- Expected:
  - "Coverage: X%" and "Performance: X%" shown as two separate visible stats
  - "N of M concepts attempted" shown below

### 6.5 No target note

- Per-document goal card where document has no `exam_date`.
- Expected:
  - Note displays "No target set" if applicable to that component

### 6.6 Learning path overall estimate breakdown

- Open the learning path with quiz history.
- Expected:
  - Overall Preparation Estimate card shows two progress bars: Coverage and Performance
  - Each shows a percentage and descriptive text
  - Composite label (Strong/Moderate/Limited/Not enough data) is derived from both

---

## Phase 7: Mastery and Learning Path Copy

### 7.1 Mastery explanation banner

- Open the learning path page with quiz history.
- Expected:
  - Info banner with HelpCircle icon appears before the prioritized sections
  - Text explains mastery is based on quiz/flashcard performance, weighted by difficulty and speed
  - Mentions spaced repetition scheduling

### 7.2 Performance section badges

- View any populated performance section (Due Today, Needs Review, Developing, Mastered).
- Expected:
  - Each section header shows a small "Based on your performance" badge next to the title

### 7.3 Milestone badges

- User who has taken at least one quiz.
- Expected:
  - "First quiz taken" badge appears in the milestones area
- User who has at least one concept at `mastered` level.
- Expected:
  - "First concept mastered" badge also appears
- New user with no quiz history.
- Expected:
  - No milestone badges shown (section hidden)

### 7.4 Analytics last_reviewed_at

- Open `/analytics`. Click into a concept drill-down.
- Expected:
  - "Last reviewed: [date]" appears in the detail grid if the concept has been reviewed
  - If `last_reviewed_at` is null, the field is not shown

---

## Phase 8: Goal Model Surfacing

### 8.1 Study goals read-only display

- If `study_goals` table has rows for the current user:
  - Expected: "Explicit Study Goals" section appears in StudyGoalsPanel with cards showing title, goal type, target value, deadline, and completion status
- If `study_goals` table is empty for the user:
  - Expected: section does not appear (no empty state for this section)

### 8.2 No CRUD operations

- Inspect the StudyGoalsPanel for create/edit/delete buttons on study_goals.
- Expected: none exist. Study goals are display-only in this phase.

---

## Cross-App Verification

### Build and type checks

- Run `npx tsc --noEmit` in `educoach/`.
- Expected: exit code 0, no errors.
- Run `npx tsc --noEmit` in `educoach-mobile/`.
- Expected: no new errors from `UserProfile` type changes.

### Supabase compatibility

- Existing queries using `select('*')` on `user_profiles` continue to work.
- New `first_name`/`last_name` columns are nullable, so old mobile rows with NULL values do not crash.

### No regressions

- Dashboard loads without errors.
- Files page upload and processing flows work as before.
- Quiz generation and attempts work as before.
- Analytics page loads and drill-down works.
- Profile page loads and save works.
- Admin user management works with new field shape.

---

## Pass criteria

- All Phase 1-8 scenarios pass.
- TypeScript compiles without errors on web.
- No new linter errors introduced.
- UI labels consistently say "Preparation Estimate" with no remaining "Readiness" text.
- Registration creates profiles with `first_name`, `last_name`, and `display_name` atomically.
- `masteryDelta` reflects real snapshot data, not fabricated numbers.
- Low-coverage users see conservative preparation labels.
