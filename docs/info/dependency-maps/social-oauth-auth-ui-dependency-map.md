# Social OAuth & Auth UI Dependency Map

Last cross-checked: 2026-04-02

**Source docs checked**
- `educoach/docs/completed/2026-03-19-social-oauth-sign-in.md`

**Primary current entry points**
- `src/pages/LoginPage.tsx`
- `src/pages/RegisterPage.tsx`
- `src/components/forms/LoginForm.tsx`
- `src/components/forms/RegisterForm.tsx`
- `src/components/auth/SocialAuthButtons.tsx`

## Current Dependency Flow

```text
LoginPage/RegisterPage
  -> LoginForm/RegisterForm
      -> SocialAuthButtons
          -> useAuth.signInWithOAuth(...)
              -> AuthContext.tsx
                  -> lib/oauthRedirect.ts
                  -> lib/authRouting.ts
                  -> lib/supabase.ts
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/pages/LoginPage.tsx` | Split-layout login screen wrapper | `LoginForm` |
| `src/pages/RegisterPage.tsx` | Split-layout registration screen wrapper | `RegisterForm` |
| `src/components/forms/LoginForm.tsx` | Handles OAuth callback error display and post-login routing | `getOAuthCallbackError`, `getOAuthReturnPath`, `clearOAuthReturnPath`, `getPostLoginDestination`, `SocialAuthButtons` |
| `src/components/forms/RegisterForm.tsx` | Renders social signup alongside email/password signup | `SocialAuthButtons` |
| `src/components/auth/SocialAuthButtons.tsx` | Provider buttons + pending state | `useAuth`, UI button primitives |
| `src/lib/oauthRedirect.ts` | Stores safe return paths in `sessionStorage` and parses callback errors | used by login flow and auth context |
| `src/lib/authRouting.ts` | Resolves final destination after OAuth login | depends on role + profiling state |

## Supabase / Backend Touchpoints

- Supabase OAuth providers through `AuthContext.signInWithOAuth`
- callback/session resolution handled through the same auth session infrastructure as email/password login
- provider readiness is not encoded in the web route graph; configuration still lives in Supabase/Auth provider settings

## Notes

- The UI redesign from the historical doc is still present in the route shell files.
- Current routing logic is shared with normal auth, so OAuth is no longer an isolated feature path; it reuses the same role/profiling redirect rules after session creation.
