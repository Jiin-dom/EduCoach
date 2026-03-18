# Social OAuth Sign-In Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google, Facebook, and Apple sign-in to the current Supabase-backed web app on both the login and registration flows.

**Architecture:** Keep Supabase as the single auth provider, extend the existing `AuthContext` with an OAuth sign-in entry point, and reuse `/login` as the redirect destination for provider callbacks. Add one shared social-auth button group component used by both `LoginForm` and `RegisterForm`, and persist the intended post-auth route in `sessionStorage` because React Router state does not survive the external OAuth round-trip.

**Tech Stack:** React 19, React Router 7, Supabase JS v2, TypeScript, Vite, Vitest

---

## Provider Setup

- In Supabase Auth URL settings, configure:
  - `http://localhost:5173/login`
  - the production `https://<domain>/login`
- Enable Google, Facebook, and Apple providers in Supabase using the callback URL shown in the dashboard:
  - `https://<project-ref>.supabase.co/auth/v1/callback`
- Google:
  - create a Web OAuth client
  - add the Supabase callback URL as an authorized redirect URI
  - paste the client ID and client secret into Supabase
  - keep nonce checks enabled
- Facebook:
  - create an app with Facebook Login
  - add the Supabase callback URL to Valid OAuth Redirect URIs
  - paste the app/client ID and secret into Supabase
- Apple:
  - create a Services ID for Sign in with Apple on the web
  - register the production domain and the Supabase callback URL as the return URL
  - generate the Apple client secret from the Apple key materials and paste it into Supabase
  - document the 6-month renewal requirement for the Apple secret
- Keep "Allow users without an email" disabled for the first rollout.

## Files and Responsibilities

- Create: `src/lib/oauthRedirect.ts`
  - store, read, and clear the OAuth return path in `sessionStorage`
  - normalize safe fallback routes
  - parse callback error details from the URL
- Create: `src/lib/oauthRedirect.test.ts`
  - unit tests for return-path storage and callback-error parsing
- Create: `src/components/auth/SocialAuthButtons.tsx`
  - render Google, Facebook, and Apple buttons
  - handle provider click actions and button-level loading states
- Modify: `src/contexts/AuthContext.tsx`
  - add `signInWithOAuth(provider, returnTo?)`
  - keep email/password flows unchanged
- Modify: `src/components/forms/LoginForm.tsx`
  - add the shared social-auth button group
  - preserve redirect behavior after OAuth returns to `/login`
  - display callback errors in the existing form error area
- Modify: `src/components/forms/RegisterForm.tsx`
  - add the shared social-auth button group
  - clarify in copy that social sign-in can create an account
- Modify: `src/pages/LoginPage.tsx`
  - review spacing only if the taller card causes crowding
- Modify: `src/pages/RegisterPage.tsx`
  - review spacing only if the taller card causes crowding
- Optional follow-up: `supabase/migrations/<new_social_profile_metadata_migration>.sql`
  - update `handle_new_user()` to seed `display_name` and `avatar_url` from provider metadata

## Chunk 1: OAuth API and Redirect Helpers

### Task 1: Add shared OAuth redirect utilities

**Files:**
- Create: `src/lib/oauthRedirect.ts`
- Test: `src/lib/oauthRedirect.test.ts`

- [ ] Add constants for the session storage key and the safe default route.
- [ ] Implement helpers to save, read, and clear the OAuth return path.
- [ ] Reject unsafe redirect targets such as absolute URLs or empty values.
- [ ] Implement a helper that reads callback errors from `window.location.search` and `window.location.hash`.
- [ ] Write Vitest coverage for:
  - saving and reading a valid in-app path
  - falling back to `/dashboard` for invalid paths
  - clearing the stored path after consumption
  - extracting provider callback errors into a readable message
- [ ] Run: `npx vitest run src/lib/oauthRedirect.test.ts`
- [ ] Expected: the new test file passes.

### Task 2: Extend the auth context with OAuth sign-in

**Files:**
- Modify: `src/contexts/AuthContext.tsx`
- Use: `src/lib/oauthRedirect.ts`

- [ ] Add an `OAuthProvider` union type: `google | facebook | apple`.
- [ ] Extend `AuthContextType` with `signInWithOAuth(provider: OAuthProvider, returnTo?: string): Promise<{ error: Error | null }>`
- [ ] Inside `signInWithOAuth`, persist the return path before calling Supabase.
- [ ] Call `supabase.auth.signInWithOAuth` with `redirectTo` set to `${window.location.origin}/login`.
- [ ] Return startup errors without changing the existing `signIn`, `signUp`, `signOut`, or `updateProfile` behavior.
- [ ] Do not introduce a dedicated callback route in this iteration.

## Chunk 2: Shared Social Buttons and Form Integration

### Task 3: Create the reusable social-auth button group

**Files:**
- Create: `src/components/auth/SocialAuthButtons.tsx`

- [ ] Build a small presentational component that renders Google, Facebook, and Apple buttons in a consistent order.
- [ ] Accept props for:
  - `onProviderClick(provider)`
  - `disabled`
  - `loadingProvider`
  - optional descriptive text such as "or continue with"
- [ ] Use text labels first; provider icons are optional and should not block implementation.
- [ ] Keep button copy neutral so the component works for both sign-in and sign-up surfaces.

### Task 4: Add social sign-in to the login form

**Files:**
- Modify: `src/components/forms/LoginForm.tsx`
- Use: `src/components/auth/SocialAuthButtons.tsx`
- Use: `src/lib/oauthRedirect.ts`

- [ ] Add the shared social-auth buttons above the credential submit button with a visible divider.
- [ ] Reuse the current error banner for provider startup failures and callback errors.
- [ ] Add provider-level loading state so only the active social button is disabled while redirect begins.
- [ ] Preserve the current email/password submit flow exactly as-is.
- [ ] On mount or after auth state settles, prefer the stored OAuth return path over React Router `location.state.from`.
- [ ] Continue routing incomplete profiles to `/profiling`; otherwise route to the stored path or `/dashboard`.
- [ ] Clear the stored OAuth return path once it has been consumed.

### Task 5: Add social sign-in to the registration form

**Files:**
- Modify: `src/components/forms/RegisterForm.tsx`
- Use: `src/components/auth/SocialAuthButtons.tsx`

- [ ] Add the same shared social-auth buttons above the email/password registration submit button.
- [ ] Add a divider such as "or continue with".
- [ ] Keep the manual sign-up form available; do not replace it.
- [ ] Update descriptive text so the screen communicates that social auth can create a new account.
- [ ] Route successful first-time social users to `/profiling` through the same auth/profile rules already used by login.

### Task 6: Review page layout after the taller forms

**Files:**
- Modify if needed: `src/pages/LoginPage.tsx`
- Modify if needed: `src/pages/RegisterPage.tsx`

- [ ] Verify that both pages still fit comfortably on common laptop heights.
- [ ] Only change page spacing or width if the new button group causes obvious crowding.
- [ ] Avoid introducing new layout abstractions for this small scope.

## Chunk 3: Verification and Follow-Up

### Task 7: Verify the full OAuth flow

**Files:**
- Verify behavior in the running app

- [ ] Confirm Google sign-in from `/login` works for a new user and routes to `/profiling`.
- [ ] Confirm Google sign-in from `/login` works for an existing profiled user and routes to the saved destination or `/dashboard`.
- [ ] Confirm the same behavior from `/register`.
- [ ] Repeat the same checks for Facebook and Apple.
- [ ] Confirm that attempting to access a protected route first, then choosing a social provider, returns the user to the original route after authentication.
- [ ] Confirm that provider denial or callback failure returns to `/login` with a readable error message.
- [ ] Run: `npm test`
- [ ] Expected: existing tests plus the new helper test pass.
- [ ] Run: `npm run build`
- [ ] Expected: production build succeeds.

### Task 8: Optional profile metadata enhancement

**Files:**
- Create: `supabase/migrations/<new_social_profile_metadata_migration>.sql`

- [ ] Decide whether the app should prefill `display_name` and `avatar_url` from provider metadata.
- [ ] If yes, add a new migration that updates `handle_new_user()` to copy supported metadata from `auth.users`.
- [ ] Keep this as a separate commit from the frontend OAuth rollout.

## Acceptance Criteria

- Google, Facebook, and Apple buttons appear on both `LoginForm` and `RegisterForm`.
- Clicking any provider starts the Supabase OAuth flow without breaking the existing email/password flows.
- OAuth return navigation survives the external redirect and restores the intended in-app destination.
- First-time social users still get a `user_profiles` row and are sent to `/profiling`.
- Existing profiled users reach `/dashboard` or the original protected route.
- Callback failures are visible to the user instead of silently leaving them on the login page.

## Notes

- Scope now includes both authentication entry points:
  - `src/components/forms/LoginForm.tsx`
  - `src/components/forms/RegisterForm.tsx`
- `LoginPage.tsx` and `RegisterPage.tsx` should only change if spacing needs adjustment after the forms grow taller.
- No backend schema change is required for the minimum rollout.
