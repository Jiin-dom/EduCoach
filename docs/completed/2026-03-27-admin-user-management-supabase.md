# Admin User Management (Supabase) — Completion Report

**Date Completed:** 2026-03-27  
**Related Work:** Role-based login and admin routing

## Feature Summary
This implementation wires the Admin User Management page to real Supabase users.

Delivered scope:
- Real user listing/search from `public.user_profiles`
- Admin create user (email/password/display name)
- Admin hard delete user
- Admin-only backend enforcement for create/delete
- Admin read policy for listing all profiles

Out of scope in this pass:
- Role promotion UI (still manual SQL)
- Edit user profile fields from admin table
- Extra columns not present in schema (`year/course/subscription`)

## What Was Implemented

### 1) Database / RLS
- Added migration: `supabase/migrations/018_admin_user_profiles_select_policy.sql`
- Added helper function `public.is_admin_user()` (`SECURITY DEFINER`) for role checks.
- Added policy: `Admins can view all profiles` on `public.user_profiles` (`FOR SELECT`).
- Existing student self-access policy remains intact.
- Existing role-escalation protections from migration `017_user_profile_roles.sql` remain unchanged.

### 2) Edge Function (Admin-only)
- Added function: `supabase/functions/admin-user-management/index.ts`
- Action-based API:
  - `create_user`
  - `delete_user`
- Security:
  - Requires bearer token.
  - Validates token using Supabase auth.
  - Fetches caller profile and requires `role = 'admin'`.
  - Blocks self-delete attempts.
- Create flow:
  - `auth.admin.createUser(...)`
  - Updates `user_profiles.display_name`
  - Enforces default `role = 'student'`
- Delete flow:
  - `auth.admin.deleteUser(userId)` (hard delete; cascades related data)

### 3) Frontend Wiring
- Added admin users hooks: `src/hooks/useAdminUsers.ts`
  - `useAdminUsers` for real listing
  - `useCreateAdminUser` for create action via edge function
  - `useDeleteAdminUser` for delete action via edge function
  - Query invalidation on mutations
- Updated admin user UI:
  - `src/components/admin/UsersManagement.tsx`
  - Table now uses real schema fields:
    - `display_name`, `email`, `role`, `has_completed_profiling`, `created_at`
  - Search works on name/email
  - Added loading/error states
  - Toast success/error feedback for create/delete
- Updated modals:
  - `src/components/admin/AddUserModal.tsx` now uses `displayName/email/password`
  - `src/components/admin/DeleteUserModal.tsx` now confirms real delete with async pending state

## API Contract Used by Frontend

### Function Name
`admin-user-management`

### Request Shapes
```json
{ "action": "create_user", "email": "user@example.com", "password": "secret123", "displayName": "User Name" }
```

```json
{ "action": "delete_user", "userId": "uuid" }
```

### Response Shape
```json
{ "success": true, "data": { "...": "..." } }
```
or
```json
{ "success": false, "error": "message" }
```

## Files Created / Modified

### Created
- `supabase/migrations/018_admin_user_profiles_select_policy.sql`
- `supabase/functions/admin-user-management/index.ts`
- `src/hooks/useAdminUsers.ts`
- `docs/completed/2026-03-27-admin-user-management-supabase.md`

### Modified
- `src/components/admin/UsersManagement.tsx`
- `src/components/admin/AddUserModal.tsx`
- `src/components/admin/DeleteUserModal.tsx`

## Verification Checklist and Outcomes
- [ ] Apply migration `018_admin_user_profiles_select_policy.sql`.
- [ ] Deploy edge function `admin-user-management`.
- [ ] Login as admin and open `/admin/users`:
  - [ ] Users list loads from Supabase.
  - [ ] Search by name/email filters correctly.
- [ ] Create user via modal:
  - [ ] New auth user is created.
  - [ ] User appears in table with role `student`.
- [ ] Delete user via modal:
  - [ ] User is removed from table.
  - [ ] Account is no longer available in auth users.
- [ ] Non-admin user access checks:
  - [ ] Non-admin cannot access admin routes.
  - [ ] Non-admin cannot call create/delete actions (forbidden).

## Known Limitations / Follow-ups
1. Role promotion is still manual SQL; no role management UI yet.
2. Admin table currently supports list/search/add/delete only.
3. Admin self-delete is intentionally blocked to reduce lockout risk.
