# Phase 3 Document Processing & Study Materials Dependency Map

Last cross-checked: 2026-04-18

**Source docs checked**
- `educoach/docs/completed/phase-3-document-processing-pipeline.md`
- `educoach/docs/completed/phase-3-concept-extraction-improvements.md`
- `educoach/docs/completed/phase-3.5-content-quality-upgrade.md`
- `educoach/docs/completed/phase-3.6-slide-aware-pipeline.md`
- `educoach/docs/completed/phase-3.7-pipeline-quality-phase2.md`
- `educoach/docs/completed/phase-3.8-pipeline-enrichment.md`
- `educoach/docs/completed/phase-3.9-ux-resilience-upgrade.md`
- `educoach/docs/info/embedding-model-migration.md`

**Primary current entry points**
- `/files/:id`

## Current Dependency Flow

```text
pages/FileDetailPage.tsx
  -> components/files/FileViewer.tsx
      -> hooks/useDocument(...)
      -> hooks/useDocumentConcepts(...)
      -> hooks/useProcessDocument(...)
      -> DocumentPane.tsx
      -> GuideTab.tsx
      -> ConceptsTab.tsx
      -> QuizPrepTab.tsx
      -> NotesTab.tsx
      -> FlashcardsTab.tsx
      -> shared/AiTutorChat.tsx
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/components/files/FileViewer.tsx` | Study-material workspace shell for a single document | `useDocument`, `useDocumentConcepts`, `useProcessDocument`, tab components |
| `src/components/files/DocumentPane.tsx` | Embedded document reader with PDF/text support | `react-pdf`, `lib/storage.ts`, `types/annotations.ts` |
| `src/components/files/GuideTab.tsx` | Structured summary and keyword study guide | `StructuredSummary`, `useConcepts` types, `lib/studyUtils.ts`, `KeyTermsGroup.tsx` |
| `src/components/files/ConceptsTab.tsx` | Search/sort/filter concept cards and launch quiz/chat actions | `useGenerateQuiz`, `getDifficultyColor`, `getImportanceColor`, `cleanDisplayText` |
| `src/components/files/NotesTab.tsx` | Per-document study notes with debounce autosave | `hooks/useNotes.ts` |
| `src/components/files/FlashcardsTab.tsx` | Flashcard review loop for a document | `hooks/useFlashcards.ts` |
| `src/hooks/useConcepts.ts` | Reads `concepts` for one document or all documents | `supabase`, `useAuth` |
| `src/hooks/useNotes.ts` | Reads/writes `study_notes` | `supabase`, `useAuth` |
| `src/hooks/useFlashcards.ts` | Flashcard fetch/generate/review + mastery recompute bridge | `supabase`, `useLearning`, `learningAlgorithms.ts` |
| `src/lib/studyUtils.ts` | Shared study text cleanup and keyword helpers | concept-driven presentation utilities |

## Supabase / Backend Touchpoints

- `public.documents`
- `public.chunks`
- `public.concepts`
- `public.document_embeddings`
- `public.study_notes`
- `public.flashcards`
- `public.adaptive_study_tasks` (Learning Path / adaptive queue; `document_id` FK to `documents`. Sync functions `sync_adaptive_study_tasks_for_document` and `archive_adaptive_study_task` run from triggers on mastery, flashcards, and quizzes. Migration `030_restore_adaptive_sync_guards_on_document_delete.sql` ensures deletes do not insert rows for a removed document—see `docs/completed/2026-04-18/2026-04-18-library-document-delete-db-and-mobile.md`.)
- `supabase/functions/process-document`
- `public.match_documents()` RPC for downstream AI tutor retrieval compatibility
- `nlp-service/main.py` and `supabase/functions/process-document/index.ts` remain the main backend owners of most phase 3.x quality changes

## Notes

- Most phase 3.5 through 3.8 changes are backend-heavy. The web-side dependency shape stayed centered on `FileViewer`, `useDocuments`, and `useConcepts`.
- Phase 3.9 materially changed the web map by reinforcing processing UX in `FileUploadDialog.tsx`, `FileViewer.tsx`, and the polling/error behavior in `useDocuments.ts`.
