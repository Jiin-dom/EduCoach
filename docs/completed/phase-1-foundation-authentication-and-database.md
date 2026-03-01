## Phase 1 -- Foundation: Authentication & Database (Completed)

This document summarizes what was implemented for Phase 1: Supabase integration, authentication flow, database foundation tables, protected routing, and user profile auto-creation.

---

## 1. High-Level Overview

- **Goal**: Establish the foundational backend that everything else depends on — authentication, database tables, storage, and protected routing.
- **Architecture**:
  - **Supabase**: Backend-as-a-Service providing Postgres database, authentication, and object storage.
  - **React Frontend**: AuthContext wrapping the app with session management, ReactQuery for data fetching, ProtectedRoute for access control.
  - **Resilient Client**: Custom Supabase client with timeout handling, retry logic, dead-socket detection, and Web Lock workarounds to prevent session deadlocks.

Compared to a simple Supabase setup, the final implementation includes extensive resilience engineering (connection warming, stale session cleanup, deduplicated refresh, global auth error handling) to handle real-world browser behavior.

---

## 2. Dependencies Installed

The following dependencies were added to `package.json`:

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase client for auth, database, and storage |
| `@tanstack/react-query` | Data fetching, caching, and synchronization |

---

## 3. Environment Variables

A `.env.local` file was created with:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key for client-side use |

These are read in `src/lib/supabase.ts` via `import.meta.env`.

---

## 4. Supabase Client (`src/lib/supabase.ts`)

The core Supabase client with resilience features:

### 4.1. Client Configuration

- Created via `createClient(supabaseUrl, supabaseAnonKey)` with custom options.
- Uses a **custom Web Lock implementation** (`lockWithTimeout`) with timeout fallback to prevent `getSession()` deadlocks caused by the browser's `navigator.locks.request()` when tabs are backgrounded.
- Uses a **custom global fetch** (`resilientFetch`) that wraps all Supabase HTTP requests with:
  - 10-second timeout per request.
  - Dead-socket detection (catches `ERR_HTTP2_PING_FAILED`, `ECONNRESET`, `TypeError: Failed to fetch`).
  - Automatic connection warming and single retry on network failures.

### 4.2. Session Management Helpers

- **`getSupabaseStorageKey()`** — Computes the localStorage key Supabase uses to persist auth sessions.
- **`isTokenExpired(jwt)`** — Decodes a JWT and checks whether it's expired (with 60-second buffer).
- **`clearStaleSession()`** — Removes stale Supabase auth data from localStorage when the session is unrecoverable.
- **`ensureFreshSession()`** — Deduplicated session refresh (only ONE `getSession()` runs at a time). Returns the session on success, null on failure. Uses a 5-second timeout to prevent hangs.
- **`warmConnection()`** — Detects and tears down dead TCP sockets by making a lightweight HEAD request to Supabase storage before critical operations.

### 4.3. Visibility Change Handler

- When the browser tab regains focus, the client warms the HTTP connection (detects dead sockets) and warms the Storage connection.
- Debounced to 3 seconds to avoid excessive requests.
- Does NOT call `getSession()` directly (avoids Web Lock deadlocks).

---

## 5. Database Schema (Migration `001_initial_schema.sql`)

This migration creates the foundational tables and policies.

### `user_profiles` Table

Extends `auth.users` with app-specific learning preferences.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | FK → auth.users, ON DELETE CASCADE |
| `email` | TEXT | |
| `display_name` | TEXT | |
| `avatar_url` | TEXT | |
| `learning_style` | TEXT | One of: visual, auditory, reading, kinesthetic |
| `study_goal` | TEXT | |
| `preferred_subjects` | TEXT[] | Array of subject strings |
| `daily_study_minutes` | INTEGER | Default 30 |
| `has_completed_profiling` | BOOLEAN | Default FALSE |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Trigger-maintained |

**RLS**: Users can only view, insert, and update their own profile.

### `documents` Table

Stores metadata for uploaded study materials.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `user_id` | UUID FK | → auth.users, ON DELETE CASCADE |
| `title` | TEXT | NOT NULL |
| `file_name` | TEXT | NOT NULL |
| `file_path` | TEXT | NOT NULL (path in Supabase Storage) |
| `file_type` | TEXT | One of: pdf, docx, txt, md |
| `file_size` | BIGINT | |
| `status` | TEXT | pending / processing / ready / error |
| `error_message` | TEXT | |
| `summary` | TEXT | Populated by Phase 3 processing |
| `concept_count` | INTEGER | Default 0, populated by Phase 3 |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Trigger-maintained |

**RLS**: Users can only view, insert, update, and delete their own documents.

### Trigger Functions

1. **`handle_new_user()`** — SQL trigger that auto-creates a `user_profiles` row when a new user signs up via `auth.users`. Runs as `SECURITY DEFINER`.
2. **`update_updated_at_column()`** — Generic trigger that sets `updated_at = NOW()` before any UPDATE on `user_profiles` and `documents`.

### Storage Bucket

- A private `documents` bucket is created in Supabase Storage.
- **Storage RLS**:
  - Users can only upload to their own folder (`{user_id}/`).
  - Users can only view and delete files in their own folder.

---

## 6. Authentication Context (`src/contexts/AuthContext.tsx`)

The `AuthProvider` wraps the entire app and manages authentication state.

### 6.1. State

- `user` — Supabase `User` object (or null).
- `profile` — `UserProfile` fetched from `user_profiles` table.
- `session` — Supabase `Session` object.
- `loading` — Boolean, true while initial auth state is resolving.
- `error` — Auth error (if any).

### 6.2. Methods

- **`signIn(email, password)`** — Calls `supabase.auth.signInWithPassword()`, fetches the user profile, returns `{ error, profile }`.
- **`signUp(email, password)`** — Calls `supabase.auth.signUp()`. Profile is auto-created by the database trigger.
- **`signOut()`** — Signs out via `supabase.auth.signOut()`, clears all React Query caches.
- **`updateProfile(updates)`** — Updates the `user_profiles` row for the current user.
- **`fetchProfile(userId)`** — Fetches the profile from `user_profiles` by user ID.

### 6.3. Auth State Listener

Uses `supabase.auth.onAuthStateChange()` to:
- Set `user` and `session` on `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`.
- Clear state on `SIGNED_OUT`.
- Invalidate React Query caches on `TOKEN_REFRESHED` so stale-token errors auto-recover.

### 6.4. Session Expiry Handling

Listens for a custom DOM event `educoach-session-expired` (dispatched by `main.tsx` when `ensureFreshSession()` fails). Triggers full local logout and redirects to login.

---

## 7. Protected Routes (`src/components/auth/ProtectedRoute.tsx`)

A wrapper component that enforces authentication.

- **Unauthenticated users** → Redirected to `/login` (saves intended destination in `location.state`).
- **Authenticated users without profiling** (when `requireProfile` is true) → Redirected to `/profiling`.
- **Authenticated, profiled users** → Renders children.
- Shows a loading spinner while auth state is resolving.

---

## 8. Auth Forms

### `LoginForm.tsx` (`src/components/forms/LoginForm.tsx`)

- Calls `signIn(email, password)` from `AuthContext`.
- On success: redirects to intended destination (from `location.state`) or `/dashboard`.
- If profile not completed: redirects to `/profiling`.
- Shows error messages from Supabase auth.
- Password visibility toggle, loading states, form validation.

### `RegisterForm.tsx` (`src/components/forms/RegisterForm.tsx`)

- Calls `signUp(email, password)` from `AuthContext`.
- Client-side validation: passwords must match, minimum 6 characters.
- On success: redirects to `/profiling` (Supabase may require email confirmation).
- Error handling for duplicate emails, weak passwords, etc.

---

## 9. App Entry Point (`src/main.tsx`)

Wraps the app with the required providers:

```
<StrictMode>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
</StrictMode>
```

### 9.1. QueryClient Configuration

- `staleTime`: 5 minutes.
- `retry`: 2 (allows auth-refresh-then-retry pattern).

### 9.2. Global Auth Error Handler

- Attached to `queryClient.getQueryCache().config.onError`.
- Detects auth errors (JWT expired, 401/403) from ANY React Query fetch.
- Calls `ensureFreshSession()` to attempt token refresh.
- On failure: dispatches `educoach-session-expired` DOM event → AuthContext logs out.
- Helper `isAuthError()` detects: `jwt expired`, `invalid jwt`, `auth session missing`, `not authenticated`, `invalid claim`, `token is expired`, status 401/403.

---

## 10. Routing (`src/App.tsx`)

Uses `react-router-dom` `createBrowserRouter` with:

- **Public routes**: `/` (landing), `/register`, `/login`.
- **Protected routes** (require auth):
  - `/profiling` — `ProtectedRoute` (no profile requirement, so new users can complete it).
  - `/dashboard`, `/files`, `/files/:id`, `/quizzes`, `/quizzes/:id`, `/learning-path`, `/analytics` — `ProtectedRoute` with `requireProfile` (must complete profiling first).
  - `/profile` — `ProtectedRoute` (auth only, no profile requirement).

---

## 11. Files Created

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client with resilience features |
| `src/contexts/AuthContext.tsx` | Auth state management (signIn, signUp, signOut, profile) |
| `src/components/auth/ProtectedRoute.tsx` | Route guard for authenticated/profiled users |
| `.env.local` | Environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) |
| `supabase/migrations/001_initial_schema.sql` | user_profiles, documents tables, triggers, storage bucket |

## 12. Files Modified

| File | Change |
|------|--------|
| `package.json` | Added @supabase/supabase-js and @tanstack/react-query |
| `src/main.tsx` | Wrapped app with QueryClientProvider + AuthProvider, global auth error handler |
| `src/App.tsx` | Wrapped dashboard routes with ProtectedRoute |
| `src/components/forms/LoginForm.tsx` | Replaced localStorage with supabase.auth.signInWithPassword() |
| `src/components/forms/RegisterForm.tsx` | Replaced localStorage with supabase.auth.signUp() |

---

## 13. How to Deploy Phase 1

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Apply the database migration**: In Supabase SQL Editor, run `supabase/migrations/001_initial_schema.sql`
3. **Configure environment variables**: Create `.env.local` with your Supabase URL and anon key
4. **Install dependencies**: `npm install`
5. **Rebuild the frontend**: `npm run dev` or `npm run build`

---

## 14. Verification Checklist

- Navigate to `/register` and create an account
  - Verify: `auth.users` row created, `user_profiles` row auto-created by trigger
- Navigate to `/login` and sign in with the new account
  - Verify: redirected to `/profiling` (since profiling is not completed)
- Try to access `/dashboard` directly while not logged in
  - Verify: redirected to `/login`
- Try to access `/dashboard` while logged in but profiling not completed
  - Verify: redirected to `/profiling`
- Sign out and verify redirect to landing page
- Check browser localStorage for Supabase auth keys
- Backgrounding and foregrounding the tab should warm the connection without errors

With these pieces in place, **Phase 1 -- Foundation: Authentication & Database is fully implemented** and provides the secure base for all subsequent phases.
