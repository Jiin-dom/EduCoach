# Library document delete — database fix and mobile alignment (2026-04-18)

## Summary

- **Supabase:** Added migration `030_restore_adaptive_sync_guards_on_document_delete.sql` to fix `adaptive_study_tasks_document_id_fkey` failures when deleting a document (see root cause below).
- **Mobile (`educoach-mobile`):** Document delete behavior matches web `useDeleteDocument` (delete DB row first with `user_id` filter, then storage; invalidate quizzes, adaptive-study, and learning queries). Library list uses a **confirmation modal** aligned with web `FilesContent` copy (title, warning about related data, destructive primary action). `FileDetailScreen` back control navigates to `FilesList` so nested entry to file detail always returns to the library list.

## Root cause (delete error toast)

Deleting a `documents` row runs **after** triggers on `user_concept_mastery`, `flashcards`, and `quizzes` that call `sync_adaptive_study_tasks_for_document(user_id, document_id)`. In the same transaction the document row can already be removed.

Migration **025** introduced guards so that when the document no longer exists, the sync functions **only delete** matching `adaptive_study_tasks` rows and **return** (no insert/update with a missing `document_id`).

Migration **028** (`028_manual_adaptive_task_rescheduling.sql`) redefined `sync_adaptive_study_tasks_for_document` and `archive_adaptive_study_task` **without** those guards, which allowed inserts/updates that violated `adaptive_study_tasks_document_id_fkey`.

Migration **030** restores the guards while keeping 028’s `user_scheduled_date` / upsert behavior.

## Apply the fix

Run pending Supabase migrations (e.g. `supabase db push` or your project’s migration process) so **030** is applied after **028**.

## Files of record

| Area | Path |
|------|------|
| Migration | `supabase/migrations/030_restore_adaptive_sync_guards_on_document_delete.sql` |
| Web delete hook | `src/hooks/useDocuments.ts` — `useDeleteDocument` |
| Mobile delete hook | `educoach-mobile/src/hooks/useDocuments.ts` — `useDeleteDocument` |
| Mobile library UI | `educoach-mobile/src/screens/FilesScreen.tsx` — delete confirmation modal |
| Mobile file detail back | `educoach-mobile/src/screens/FileDetailScreen.tsx` — `BackButton` → `navigate('FilesList')` |

## Related docs

- `docs/implementation/adaptive-study-tasks-behavioral-spec.md` — document deletion and adaptive tasks
- `docs/info/dependency-maps/phase-3-document-processing-study-materials-dependency-map.md` — Supabase touchpoints
