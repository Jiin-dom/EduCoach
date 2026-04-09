# In-App Notifications (Web-First) — Completion Report

**Date Completed:** 2026-03-28  
**Feature:** Supabase-native in-app notifications with live bell inbox (web)  
**Delivery Model:** In-app only (no email/push), deterministic templates

## Summary
Implemented a full Supabase-backed notification system and replaced the static bell data in the dashboard header.

What is now live in code:
- Persistent `public.notifications` inbox table with RLS.
- Trigger-driven notifications for documents, quizzes, attempts, subscriptions, and mastery changes.
- Scheduled reminders for deadlines/exams/trial lifecycle using D-3, D-1, D0, overdue cadence.
- Frontend bell dropdown now reads from database, shows unread badge, supports mark single/all read.
- Realtime updates via Supabase `postgres_changes` + polling fallback.
- AI Tutor free-tier quota notifications (near limit and limit reached).

## Scope Implemented

### 1) Database Foundation
Added migration:
- `supabase/migrations/023_notifications_in_app.sql`

Created:
- `public.notifications`
  - `user_id`, `type`, `title`, `body`, `cta_route`, `entity_type`, `entity_id`, `payload`, `read_at`, `created_at`, `expires_at`, `dedupe_key`
- Indexes:
  - `(user_id, read_at, created_at DESC)`
  - `(user_id, dedupe_key)`
- Uniqueness:
  - `UNIQUE(user_id, dedupe_key)` for idempotency

RLS and safety:
- Users can only `SELECT` and `UPDATE` their own rows.
- Service role can manage all rows.
- `guard_notification_user_updates()` prevents users from changing immutable fields; users can only update read state.

Helper API:
- `public.create_notification(...)`
  - Supports optional dedupe via `dedupe_key`.
  - Returns inserted row id or existing row id for same dedupe key.
  - Hardened so authenticated callers can only create notifications for themselves.

### 2) Trigger Emitters
Implemented trigger functions and triggers:

1. `notify_document_status_change()` on `public.documents` (`AFTER UPDATE`)
- Emits:
  - `document_ready`
  - `document_error`

2. `notify_quiz_status_change()` on `public.quizzes` (`AFTER UPDATE`)
- Emits:
  - `quiz_ready`
  - `quiz_error`

3. `notify_attempt_insert()` on `public.attempts` (`AFTER INSERT`)
- Emits:
  - `quiz_attempt_completed`
  - `progress_milestone` (1, 3, 5, 10, 20, 50 completed quizzes)
  - `streak_milestone` (3, 7, 14, 30 day streak)
- Guarded to skip rows where `completed_at IS NULL`.

4. `notify_subscription_change()` on `public.subscriptions` (`AFTER INSERT OR UPDATE`)
- Emits:
  - `trial_started`
  - `subscription_changed`

5. `notify_mastery_level_change()` on `public.user_concept_mastery` (`AFTER UPDATE`)
- Emits:
  - `mastery_level_up`
  - `mastery_level_down`

### 3) Scheduled Reminders and Retention
Implemented scheduler helpers:

1. `generate_reminder_notifications(reference_date)`
- Deadline reminders from `documents.deadline`:
  - `deadline_reminder` at D-3, D-1, D0, overdue
- Exam reminders from `documents.exam_date`:
  - `exam_reminder` at D-3, D-1, D0, overdue
- Trial reminders from `subscriptions.trial_ends_at`:
  - `trial_reminder` at D-3, D-1, D0
  - `trial_ended` at overdue (when plan is free)
- Uses dedupe keys to prevent duplicates per user/event/day.

2. `cleanup_old_notifications()`
- Deletes rows older than 90 days or already expired.

Optional cron setup included:
- `educoach_notification_reminders_daily`
- `educoach_notification_cleanup_daily`
- Registration is safe no-op if `pg_cron` is unavailable.

### 4) Frontend Bell Integration
Updated header:
- `src/components/layout/DashboardHeader.tsx`

New behavior:
- Notification list is now fetched from `public.notifications`.
- Unread count badge is computed from `read_at IS NULL`.
- Click notification:
  - marks row as read
  - navigates to `cta_route` if present
- “Mark all as read” updates all unread rows for current user.
- Empty state: “You are all caught up.”

Added hook:
- `src/hooks/useNotifications.ts`

Hook capabilities:
- Fetch latest notifications (default 25).
- Filter out expired notifications (`expires_at` check).
- Realtime invalidation on insert/update/delete via Supabase channel.
- Polling fallback every 60s and refetch-on-focus.
- Mutation helpers:
  - `useMarkNotificationRead()`
  - `useMarkAllNotificationsRead()`

Added types:
- `src/types/notifications.ts`
- Strict `NotificationType` union + payload contracts.

### 5) AI Tutor Quota Notifications
Updated:
- `supabase/functions/ai-tutor/index.ts`

For non-premium users:
- Emits `ai_tutor_quota_reached` when free daily limit is reached.
- Emits `ai_tutor_quota_warning` when remaining messages are low (<= 3).
- Uses date-based dedupe keys for daily idempotency.

## Notification Taxonomy Implemented
- `document_ready`
- `document_error`
- `quiz_ready`
- `quiz_error`
- `quiz_attempt_completed`
- `deadline_reminder`
- `exam_reminder`
- `trial_started`
- `trial_reminder`
- `trial_ended`
- `subscription_changed`
- `ai_tutor_quota_warning`
- `ai_tutor_quota_reached`
- `mastery_level_up`
- `mastery_level_down`
- `progress_milestone`
- `streak_milestone`

## Files Added / Modified

### Added
- `supabase/migrations/023_notifications_in_app.sql`
- `src/hooks/useNotifications.ts`
- `src/types/notifications.ts`

### Modified
- `src/components/layout/DashboardHeader.tsx`
- `supabase/functions/ai-tutor/index.ts`

## How To Test

## A) Apply Migration
1. Apply migrations in your normal Supabase workflow.
2. Confirm table and helper function exist:
```sql
select to_regclass('public.notifications');
select proname from pg_proc where proname in (
  'create_notification',
  'generate_reminder_notifications',
  'cleanup_old_notifications'
);
```

## B) Trigger Validation (SQL)
Use a test user and run each scenario. Verify rows in `public.notifications`.

### 1) Document status
```sql
-- set document to ready/error and verify notification types
update public.documents set status = 'ready' where id = '<doc_uuid>';
update public.documents set status = 'error', error_message = 'test error' where id = '<doc_uuid>';

select type, title, body, dedupe_key, created_at
from public.notifications
where user_id = '<user_uuid>'
order by created_at desc;
```

### 2) Quiz status
```sql
update public.quizzes set status = 'ready' where id = '<quiz_uuid>';
update public.quizzes set status = 'error', error_message = 'test error' where id = '<quiz_uuid>';
```

### 3) Attempt insert
```sql
insert into public.attempts (
  id, user_id, quiz_id, score, total_questions, correct_answers, completed_at
) values (
  gen_random_uuid(), '<user_uuid>', '<quiz_uuid>', 80, 10, 8, now()
);
```
Expect at least `quiz_attempt_completed`; milestone/streak types appear only at thresholds.

### 4) Subscription lifecycle
```sql
-- trial started on insert/update and subscription changed on plan/status transition
update public.subscriptions
set plan = 'premium', status = 'active', trial_started_at = now(), trial_ends_at = now() + interval '14 days'
where user_id = '<user_uuid>';

update public.subscriptions
set plan = 'free', status = 'active'
where user_id = '<user_uuid>';
```

### 5) Mastery movement
```sql
update public.user_concept_mastery
set mastery_level = 'developing'
where user_id = '<user_uuid>' and concept_id = '<concept_uuid>';

update public.user_concept_mastery
set mastery_level = 'needs_review'
where user_id = '<user_uuid>' and concept_id = '<concept_uuid>';
```

## C) Scheduler Validation
Run manually:
```sql
select public.generate_reminder_notifications((now() at time zone 'Asia/Manila')::date);
```
Then verify:
```sql
select type, payload, dedupe_key, created_at
from public.notifications
where user_id = '<user_uuid>'
  and type in ('deadline_reminder', 'exam_reminder', 'trial_reminder', 'trial_ended')
order by created_at desc;
```
Run generator twice and confirm no duplicate deduped rows for same cadence/day.

## D) RLS Validation
As user A, ensure user B notifications are inaccessible:
```sql
select * from public.notifications where user_id = '<other_user_uuid>';
```
Should return no rows under RLS for standard authenticated context.

## E) Frontend Validation
1. Sign in as test student user.
2. Open header bell:
- Verify unread badge count.
- Verify dropdown list rendering and empty state.
3. Click a notification:
- Should mark as read.
- Should navigate to `cta_route` when provided.
4. Click “Mark all as read”:
- Badge should reset to 0.
- Rows should have `read_at` populated.
5. Trigger a new notification from SQL or workflow and verify near-live bell update.

## F) End-to-End Smoke
1. Upload/process a document.
2. Generate quiz for that document.
3. Complete a quiz attempt.
4. Check bell items include the expected progression:
- document ready/error
- quiz ready/error
- attempt completed (+ milestones if threshold hit)

## Known Notes
- Notification copy is deterministic; no Gemini-generated notification text is used.
- This implementation is web-first and in-app only.
- Build/test command execution could not be completed in the current environment due local WSL runtime limitation (`WSL 1` issue), so run your normal CI/local checks after pulling changes.
