# In-App Notifications Dependency Map

Last cross-checked: 2026-04-02

**Source docs checked**
- `educoach/docs/completed/2026-03-28-in-app-notifications-web-first.md`

**Primary current entry points**
- bell inbox in `src/components/layout/DashboardHeader.tsx`

## Current Dependency Flow

```text
DashboardHeader.tsx
  -> hooks/useNotifications.ts
      -> useNotifications()
      -> useMarkNotificationRead()
      -> useMarkAllNotificationsRead()
  -> types/notifications.ts
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/components/layout/DashboardHeader.tsx` | Renders bell badge, dropdown inbox, click-through navigation, mark-all-read | notification hooks, `NotificationRecord` type |
| `src/hooks/useNotifications.ts` | Notification query layer, realtime invalidation, polling fallback, read mutations | `supabase`, `useAuth`, React Query |
| `src/types/notifications.ts` | Canonical notification type/payload definitions | shared with header hook/component |

## Supabase / Backend Touchpoints

- `public.notifications`
- realtime `postgres_changes` subscription on the `notifications` table
- trigger/scheduler emitters described in the historical doc for:
  - documents
  - quizzes
  - attempts
  - subscriptions
  - mastery changes
  - AI tutor quota

## Notes

- On the web app, notifications are currently a header-level cross-cutting feature rather than a dedicated page.
- The dependency direction is mostly one-way: other features create notifications in Supabase, while the web app reads and acknowledges them through the header.
