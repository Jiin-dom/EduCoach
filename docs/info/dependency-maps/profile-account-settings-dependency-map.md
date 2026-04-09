# Profile & Account Settings Dependency Map

Last cross-checked: 2026-04-02

**Source docs checked**
- `educoach/docs/completed/feature-change-password.md`

**Primary current entry points**
- `/profile`

## Current Dependency Flow

```text
pages/ProfilePage.tsx
  -> components/profile/ProfileContent.tsx
      -> useAuth()
      -> useLearningStats()
      -> useConceptMasteryList()
      -> useDocuments()
      -> supabase.auth.updateUser(...)
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/pages/ProfilePage.tsx` | Profile route shell | `DashboardHeader`, `ProfileContent` |
| `src/components/profile/ProfileContent.tsx` | Profile summary, display-name update, password change, local preference toggles, logout action | `useAuth`, `useLearningStats`, `useConceptMasteryList`, `useDocuments`, `supabase`, `toast` |
| `src/contexts/AuthContext.tsx` | Supplies profile data and `updateProfile()` used by profile settings | auth/session/profile owner |

## Supabase / Backend Touchpoints

- `public.user_profiles` for display-name updates
- `supabase.auth.updateUser(...)` for password changes
- learning/document queries reused for profile stats and summaries

## Notes

- The documented change-password feature is implemented inside `ProfileContent.tsx`; it is not broken out into a dedicated hook or page.
- Current notification and dark-mode switches in `ProfileContent.tsx` are UI-local state, not persisted settings. The persisted account actions in this map are display-name update and password change.
