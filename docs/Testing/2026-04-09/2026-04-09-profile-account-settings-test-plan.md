# Profile & Account Settings Test Plan

- Date: 2026-04-09
- Feature area: Profile settings, display name, password change, learning summaries, study availability
- Dependency map: `educoach/docs/info/dependency-maps/profile-account-settings-dependency-map.md`
- Current route: `/profile`

## Cross-checked scope

This plan is based on:

- `src/pages/ProfilePage.tsx`
- `src/components/profile/ProfileContent.tsx`
- `src/contexts/AuthContext.tsx`
- `src/hooks/useLearning.ts`
- `src/hooks/useDocuments.ts`

## Core scenarios

### 1. Open profile page

- Open `/profile`.
- Expected:
  - profile summary loads
  - display name, email, study availability, and learning summaries render

### 2. Update display name

- Change display name and save.
- Expected:
  - profile update succeeds
  - updated name appears in profile and other app surfaces that consume profile data

### 3. Update study availability

- Change available days, study time window, and daily study minutes.
- Save.
- Expected:
  - profile update succeeds
  - if goal-dated documents exist, learning path replanning is triggered

### 4. Manual replan

- Click `Replan Learning Path`.
- Expected:
  - progress state is shown
  - result message reflects success, partial success, or no goal-dated documents

### 5. Change password

- Use the change-password dialog.
- Enter current password and a valid new password.
- Expected:
  - password updates successfully through Supabase Auth
  - success state is shown

## Edge cases

- empty display name
- invalid study time window
- no available days selected
- password confirmation mismatch
- wrong current password
- local-only UI toggles like dark mode or notifications should not be mistaken for persisted settings

## Validation points

- persisted settings are display name, password, and study-availability fields
- local UI toggles do not falsely imply backend persistence

## Pass criteria

- Profile page loads, saves persisted account fields correctly, and handles password changes and replanning safely.
