# Admin User Management Dependency Map

Last cross-checked: 2026-04-02

**Source docs checked**
- `educoach/docs/completed/2026-03-27-admin-user-management-supabase.md`
- `educoach/docs/info/admin-bootstrap.md`

**Primary current entry points**
- `/admin/users`
- `/admin/subscriptions`

## Current Dependency Flow

```text
App.tsx
  -> ProtectedRoute requireAdmin
      -> pages/AdminUsersPage.tsx -> UsersManagement.tsx
      -> pages/AdminSubscriptionsPage.tsx -> SubscriptionsManagement.tsx

Admin pages
  -> AdminHeader.tsx
  -> hooks/useAdminUsers.ts
  -> hooks/useAdminSubscriptions.ts
  -> admin-user-management edge function
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/pages/AdminUsersPage.tsx` | Admin users route shell | `AdminHeader`, `UsersManagement` |
| `src/pages/AdminSubscriptionsPage.tsx` | Admin subscriptions route shell | `AdminHeader`, `SubscriptionsManagement` |
| `src/components/admin/AdminHeader.tsx` | Admin nav/header/logout | `useAuth`, router links |
| `src/components/admin/UsersManagement.tsx` | User list/search/create/delete/subscription handoff | `useAdminUsers`, `useCreateAdminUser`, `useDeleteAdminUser`, `useUpdateAdminSubscription` |
| `src/components/admin/SubscriptionsManagement.tsx` | Subscription list/search/stats/edit flow | `useAdminSubscriptions`, `useAdminSubscriptionStats`, `useUpdateAdminSubscription` |
| `src/components/admin/AddUserModal.tsx`, `DeleteUserModal.tsx`, `EditSubscriptionModal.tsx` | Admin action modals | UI primitives + admin hooks/lib types |
| `src/hooks/useAdminUsers.ts` | Admin user query/create/delete API wrapper | `supabase`, `ensureFreshSession`, `useAuth` |
| `src/hooks/useAdminSubscriptions.ts` | Admin subscription list/stats/update API wrapper | `supabase`, `ensureFreshSession`, `useAuth`, `adminUserKeys` |

## Supabase / Backend Touchpoints

- `public.user_profiles`
- `public.subscriptions`
- `supabase/functions/admin-user-management`
- role gating through `public.user_profiles.role` and `ProtectedRoute requireAdmin`

## Notes

- Admin bootstrap is intentionally outside the UI dependency chain after first promotion; once a user is marked `admin`, the normal login/auth stack routes them into this map automatically.
- Subscription editing is shared between the admin users table and the dedicated admin subscriptions page, so both pages depend on `useAdminSubscriptions.ts`.
