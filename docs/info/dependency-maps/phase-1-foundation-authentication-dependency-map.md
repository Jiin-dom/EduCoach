# Phase 1 Foundation & Authentication Dependency Map

Last cross-checked: 2026-04-02

**Source docs checked**
- `educoach/docs/completed/phase-1-foundation-authentication-and-database.md`
- `educoach/docs/info/admin-bootstrap.md`

**Primary current entry points**
- `src/main.tsx`
- `src/App.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/RegisterPage.tsx`
- `src/pages/ProfilingPage.tsx`

## Current Dependency Flow

```text
src/main.tsx
  -> contexts/AuthContext.tsx
  -> App.tsx
      -> components/auth/ProtectedRoute.tsx
      -> pages/LoginPage.tsx -> components/forms/LoginForm.tsx
      -> pages/RegisterPage.tsx -> components/forms/RegisterForm.tsx
      -> pages/ProfilingPage.tsx -> components/forms/ProfilingForm.tsx

contexts/AuthContext.tsx
  -> lib/supabase.ts
  -> lib/oauthRedirect.ts
  -> lib/authRouting.ts
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/main.tsx` | Boots React Query + auth provider + router | `AuthProvider`, `ensureFreshSession`, `App.tsx` |
| `src/contexts/AuthContext.tsx` | Session state, profile hydration, sign-in/sign-up/sign-out, post-refresh behavior | `lib/supabase.ts`, `lib/oauthRedirect.ts`, `lib/authRouting.ts` |
| `src/components/auth/ProtectedRoute.tsx` | Enforces auth, profiling, premium, and admin access | `useAuth`, `lib/subscription.ts` |
| `src/lib/authRouting.ts` | Central post-login destination rules | `DEFAULT_RETURN_PATH` from `lib/oauthRedirect.ts` |
| `src/pages/LoginPage.tsx` / `src/pages/RegisterPage.tsx` | Presentation shells for auth | form components only |
| `src/components/forms/LoginForm.tsx` | Email/password login flow + redirect handling | `useAuth`, `authRouting`, `oauthRedirect`, `SocialAuthButtons` |
| `src/components/forms/RegisterForm.tsx` | Email/password sign-up flow | `useAuth`, `SocialAuthButtons` |
| `src/components/forms/ProfilingForm.tsx` | Completes onboarding profile required by protected student routes | `useAuth.updateProfile` |

## Supabase / Backend Touchpoints

- Supabase Auth session from `auth.users`
- `public.user_profiles` for role, profiling status, and app profile fields
- session refresh/recovery logic inside `src/lib/supabase.ts`
- admin bootstrap still depends on manual role promotion in Supabase, then `getPostLoginDestination()` redirects admins to `/admin/users`

## Notes

- Current auth flow is more centralized than the original phase doc because `ProtectedRoute` now also handles `requirePremium` and `requireAdmin`.
- The auth foundation map intentionally stops before feature-specific premium/admin behavior; those live in the subscription and admin maps.
