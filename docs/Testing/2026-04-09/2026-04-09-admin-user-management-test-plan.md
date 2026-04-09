# Admin User Management Test Plan

- Date: 2026-04-09
- Feature area: Admin user and subscription management
- Dependency map: `educoach/docs/info/dependency-maps/admin-user-management-dependency-map.md`
- Current routes: `/admin/users`, `/admin/subscriptions`

## Cross-checked scope

This plan is based on:

- `src/pages/AdminUsersPage.tsx`
- `src/pages/AdminSubscriptionsPage.tsx`
- `src/components/admin/UsersManagement.tsx`
- `src/components/admin/SubscriptionsManagement.tsx`
- `src/components/admin/AddUserModal.tsx`
- `src/components/admin/DeleteUserModal.tsx`
- `src/components/admin/EditSubscriptionModal.tsx`
- `src/hooks/useAdminUsers.ts`
- `src/hooks/useAdminSubscriptions.ts`

## Core scenarios

### 1. Admin route guard

- Log in as an admin.
- Open `/admin/users` and `/admin/subscriptions`.
- Expected:
  - both pages load
  - normal students cannot access them

### 2. User search and list

- Open `/admin/users`.
- Search for an existing user.
- Expected:
  - list loads
  - search/filter narrows results correctly

### 3. Add user

- Use the add-user flow.
- Expected:
  - user is created successfully
  - new user appears in the list

### 4. Delete user

- Delete a non-critical test user.
- Expected:
  - user is removed from the admin list
  - stale row does not remain visible

### 5. Edit subscription from users page

- Edit a user’s subscription from the users-management area.
- Expected:
  - update succeeds
  - user row reflects the changed subscription

### 6. Subscription management page

- Open `/admin/subscriptions`.
- Review list and stats.
- Edit a subscription.
- Expected:
  - subscription stats load
  - edited subscription updates in the table

## Edge cases

- non-admin directly visits admin route
- add user with duplicate email
- delete currently signed-in admin or protected account if disallowed by current backend rules
- subscription edit fails from edge function
- stale list after an admin mutation

## Validation points

- both admin pages stay consistent because subscription editing is shared
- mutations are scoped behind admin role gating

## Pass criteria

- Admin-only pages load for admins, block students, and support list/create/delete/update flows.
