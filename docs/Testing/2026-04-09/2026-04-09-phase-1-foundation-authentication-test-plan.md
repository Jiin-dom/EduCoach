# Phase 1 Foundation & Authentication Test Plan

- Date: 2026-04-09
- Feature area: Phase 1 foundation and authentication
- Dependency map: `educoach/docs/info/dependency-maps/phase-1-foundation-authentication-dependency-map.md`
- Current routes: `/login`, `/register`, `/profiling`, protected routes in `App.tsx`

## Cross-checked scope

This plan is based on:

- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/forms/LoginForm.tsx`
- `src/components/forms/RegisterForm.tsx`
- `src/components/forms/ProfilingForm.tsx`
- `docs/completed/phase-1-foundation-authentication-and-database.md`

## Core scenarios

### 1. Email registration

- Open `/register`.
- Create a new student account with valid email and password.
- Expected:
  - account creation succeeds
  - session is created or user is guided into the correct next step
  - the user is routed toward profiling or the correct post-auth destination

### 2. Email login

- Open `/login`.
- Sign in with a valid existing student account.
- Expected:
  - login succeeds
  - redirect follows the current routing rules
  - unprofiled student goes to `/profiling`
  - profiled student goes to `/dashboard`

### 3. Protected route redirect for signed-out users

- While signed out, try opening:
  - `/dashboard`
  - `/files`
  - `/quizzes`
  - `/learning-path`
- Expected:
  - each route redirects to `/login`
  - no protected page content flashes first

### 4. Profiling gate

- Log in with a user whose profile is incomplete.
- Attempt to open `/dashboard`.
- Expected:
  - `ProtectedRoute` sends the user to `/profiling`
  - after profiling is saved, the user can access protected student routes

### 5. Sign out

- While signed in, sign out from the app.
- Expected:
  - session clears
  - protected routes become inaccessible
  - navigating back to a protected page redirects to login

### 6. Admin route gate

- Log in as a normal student.
- Try `/admin/users`.
- Expected:
  - access is denied or redirected
  - student does not see admin content

### 7. Admin post-login destination

- Log in as an admin user.
- Expected:
  - post-login routing sends the admin to `/admin/users`
  - admin does not get forced through the normal student profiling flow

## Edge cases

- wrong password on `/login`
- duplicate email on `/register`
- expired or stale session on page reload
- user profile exists but is only partially populated
- direct navigation to `/profiling` by an already-profiled user
- role mismatch where `user_profiles.role` does not permit admin access

## Validation points

- auth errors are shown clearly
- route guards are deterministic
- refresh does not silently drop a valid session
- protected pages do not render before auth/profile gating completes

## Pass criteria

- Authentication works for new and existing users.
- Route protection behaves correctly for signed-out, student, and admin users.
- Profiling remains the required gate for normal student routes.
