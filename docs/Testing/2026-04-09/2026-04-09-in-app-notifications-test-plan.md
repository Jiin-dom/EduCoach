# In-App Notifications Test Plan

- Date: 2026-04-09
- Feature area: In-app notifications
- Dependency map: `educoach/docs/info/dependency-maps/in-app-notifications-dependency-map.md`
- Current entry point: bell inbox in `DashboardHeader.tsx`

## Cross-checked scope

This plan is based on:

- `src/components/layout/DashboardHeader.tsx`
- `src/hooks/useNotifications.ts`
- `src/types/notifications.ts`

## Core scenarios

### 1. Notification badge count

- Sign in as a user with unread notifications.
- Expected:
  - bell badge count appears
  - count matches unread inbox items

### 2. Open inbox dropdown

- Click the bell icon.
- Expected:
  - dropdown opens
  - notifications list is readable
  - unread versus read state is visually clear

### 3. Click-through navigation

- Click a notification that points to another route.
- Expected:
  - user is navigated to the correct page
  - notification state updates appropriately if current behavior marks it as read

### 4. Mark single notification read

- Mark one notification as read using current UI behavior.
- Expected:
  - unread styling clears
  - unread count decreases

### 5. Mark all notifications read

- Use the mark-all-read action.
- Expected:
  - all visible unread notifications become read
  - badge count clears

### 6. Realtime or polling refresh

- Generate a new notification while the user is signed in.
- Expected:
  - inbox updates via realtime or polling fallback
  - user does not need a full reload to see it

## Edge cases

- zero notifications
- malformed notification payload
- realtime subscription unavailable so polling fallback must carry updates
- clicking a notification whose target record no longer exists

## Validation points

- notification reading and acknowledgement only affect the current signed-in user
- header-level feature works without a dedicated notifications page

## Pass criteria

- Inbox display, unread count, read mutations, and live refresh work from the header.
