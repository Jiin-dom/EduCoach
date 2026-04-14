# Social OAuth & Auth UI Test Plan

- Date: 2026-04-09
- Feature area: Social OAuth and auth UI
- Dependency map: `educoach/docs/info/dependency-maps/social-oauth-auth-ui-dependency-map.md`
- Current routes: `/login`, `/register`

## Cross-checked scope

This plan is based on:

- `src/pages/LoginPage.tsx`
- `src/pages/RegisterPage.tsx`
- `src/components/auth/SocialAuthButtons.tsx`
- `src/components/forms/LoginForm.tsx`
- `src/components/forms/RegisterForm.tsx`
- `src/lib/oauthRedirect.ts`
- `src/lib/authRouting.ts`

## Core scenarios

### 1. OAuth sign-in from login

- Open `/login`.
- Click each enabled provider button one at a time.
- Complete a valid OAuth login.
- Expected:
  - provider flow starts correctly
  - user returns to the app with a valid session
  - post-login destination follows normal auth routing rules

### 2. OAuth sign-up from register

- Open `/register`.
- Click an OAuth provider.
- Complete account creation through the provider.
- Expected:
  - user returns to the app signed in
  - new user is sent into profiling if needed

### 3. Return-path preservation

- While signed out, try opening a protected page like `/files`.
- Let the app redirect you to `/login`.
- Start OAuth login and complete it.
- Expected:
  - safe return path is preserved
  - final redirect obeys role/profile rules without losing the intended destination when allowed

### 4. OAuth error display

- Simulate or trigger a denied/cancelled OAuth callback.
- Return to `/login`.
- Expected:
  - callback error is surfaced on the form
  - the app does not get stuck in a loading state

### 5. Pending state on provider buttons

- Click a provider button.
- Expected:
  - duplicate clicks are prevented while the flow is starting
  - UI shows a clear pending state

## Edge cases

- provider popup blocked or cancelled
- callback contains an error parameter
- session storage return path is invalid or unsafe
- OAuth login for an admin user
- OAuth login for a student who still needs profiling

## Validation points

- provider buttons render in both login and register flows
- OAuth uses the same session/auth plumbing as email/password auth
- callback errors do not break the page shell

## Pass criteria

- OAuth sign-in and sign-up both work from the current auth UI.
- Safe redirect handling works.
- Error and pending states are visible and recoverable.
