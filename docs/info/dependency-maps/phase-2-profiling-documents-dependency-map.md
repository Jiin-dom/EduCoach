# Phase 2 Profiling, Core Data & Document Library Dependency Map

Last cross-checked: 2026-04-02

**Source docs checked**
- `educoach/docs/completed/phase-2-user-profiling-and-core-data.md`
- `educoach/docs/completed/feature-assign-deadline.md`

**Primary current entry points**
- `/profiling`
- `/dashboard`
- `/files`

## Current Dependency Flow

```text
pages/ProfilingPage.tsx
  -> components/forms/ProfilingForm.tsx
      -> useAuth.updateProfile(...)

pages/FilesPage.tsx
  -> components/files/FilesContent.tsx
      -> FileUploadDialog.tsx
          -> hooks/useDocuments.ts
          -> hooks/useGoalWindowScheduling.ts
          -> lib/storage.ts
          -> lib/supabase.ts
      -> GenerateQuizDialog.tsx

components/dashboard/DashboardContent.tsx
  -> FileUploadDialog.tsx
  -> hooks/useDocuments.ts
  -> hooks/useQuizzes.ts
  -> hooks/useLearning.ts
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/components/forms/ProfilingForm.tsx` | Captures display name, learning style, goals, study time, and available study days | `useAuth.updateProfile` |
| `src/hooks/useDocuments.ts` | Document list/detail CRUD, polling, updates, processing trigger | `supabase`, `ensureFreshSession`, `deleteFile` |
| `src/components/files/FileUploadDialog.tsx` | Upload UX, storage validation, processing kickoff, goal-window scheduling | `useAuth`, `uploadFile`, `useProcessDocument`, `useScheduleDocumentGoalWindow` |
| `src/components/files/FilesContent.tsx` | Main document-library list page | `useDocuments`, `useDeleteDocument`, `useProcessDocument`, `GenerateQuizDialog` |
| `src/components/dashboard/DashboardContent.tsx` | Reuses document, quiz, and upload flows on the dashboard | `useDocuments`, `useQuizzes`, `useLearningStats`, `useStudentSubscription` |
| `src/lib/storage.ts` | File validation, upload, delete, URL retrieval, file metadata helpers | `lib/supabase.ts` |
| `src/hooks/useGoalWindowScheduling.ts` | Mutations that schedule/deactivate study windows when exam dates exist | `services/goalWindowScheduling.ts`, `learningKeys` |
| `src/services/goalWindowScheduling.ts` | Allocates placeholder `due_date` values from exam windows and study availability | `supabase`, `learningAlgorithms.ts` |

## Supabase / Backend Touchpoints

- `public.user_profiles` for onboarding/profile data
- `public.documents` for uploaded file metadata, status, deadline, and exam date
- Supabase Storage bucket used through `src/lib/storage.ts`
- `supabase/functions/process-document` invoked by `useProcessDocument`
- `public.user_concept_mastery` indirectly touched by goal-window scheduling when exam dates are set

## Notes

- The old “assign deadline” feature is no longer isolated; its current wiring is split between `useUpdateDocument()` in `useDocuments.ts` and goal-window scheduling hooks/services.
- Phase 2 now spills into dashboard behavior because upload/reprocess/delete entry points are shared between `/files` and `/dashboard`.
