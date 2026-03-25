# EduCoach — Remaining Work (TODO)

> This file is intended as the single “what’s left” checklist.
> Last generated: 2026-03-18

## Highest priority (correctness + clarity)

- [ ] **Reconcile workflow docs vs actual implementation**
  - `docs/WORKFLOW.md` and `docs/WORKFLOW_PURE_NLP.md` still show Phase 4/5 as “not started / TODO”, but there are “completed” implementation docs and corresponding code in `src/` and `supabase/`.
  - Update the **Implementation Status** tables so they reflect reality (Quizzes, Learning Intelligence/Analytics, AI Tutor, Flashcards).
  - Files to review:
    - `docs/WORKFLOW.md`
    - `docs/WORKFLOW_PURE_NLP.md`
    - `docs/completed/phase-4-quiz-generation-and-attempts.md`
    - `docs/completed/phase-5-learning-intelligence-and-analytics.md`
    - `docs/completed/phase-6-ai-tutor-chat-rag.md`
    - `docs/completed/phase-3.8-pipeline-enrichment.md` (flashcards)

- [ ] **Replace the template README with a real project README**
  - Current `README.md` is the default Vite template.
  - Add: what EduCoach is, feature list, local dev steps, required env vars, Supabase migrations/functions, NLP service notes (if applicable), and where the authoritative workflow doc lives.

## Flashcards (finish wiring + verify generation path)

- [ ] **Confirm flashcards generation pipeline is correct and reachable from the UI**
  - UI entry point currently exists (`src/components/files/FlashcardsTab.tsx`).
  - Hook exists (`src/hooks/useFlashcards.ts`), but generation is invoked via `supabase.functions.invoke('process-document')`.
  - Verify on the backend that `process-document` actually generates flashcards (per `docs/completed/phase-3.8-pipeline-enrichment.md`) and that it does so without needing a full re-process, or adjust the UI/hook to call a dedicated flashcard generator.
  - Files to review:
    - `src/hooks/useFlashcards.ts`
    - `src/components/files/FlashcardsTab.tsx`
    - `supabase/functions/process-document/*` (flashcards generation step)
    - `supabase/migrations/010_pipeline_enrichment.sql` (flashcards table)
    - `nlp-service/main.py` (`POST /generate-flashcards` endpoint), if the NLP service is part of your deployment

## Production hardening

- [ ] **Gate or remove debug `console.log` statements**
  - They’re currently present in several runtime paths (auth, storage, documents, quizzes, file upload).
  - Convert to a small logger that is disabled in production, or remove logs that aren’t actionable.
  - Files with known logs (non-exhaustive):
    - `src/lib/supabase.ts`
    - `src/lib/storage.ts`
    - `src/contexts/AuthContext.tsx`
    - `src/hooks/useDocuments.ts`
    - `src/hooks/useQuizzes.ts`
    - `src/components/files/FileUploadDialog.tsx`
    - `src/components/files/FilesContent.tsx`

- [ ] **End-to-end verification checklist (real environment)**
  - Document upload → process → summary/concepts show.
  - Generate quiz → take quiz → attempt saved.
  - Learning intelligence updates after submission (mastery, due dates, weak topics).
  - Flashcards generated → review session updates due dates and learning metrics.
  - AI Tutor chat retrieves sources and persists conversations/messages.

## Nice-to-have (quality)

- [ ] **Add/expand automated tests for learning algorithms**
  - Unit tests for WMS + SM-2 functions in `src/lib/learningAlgorithms.ts`.
  - A few fixtures for edge cases (no attempts, low confidence, repeated failures, ease-factor floor).

- [ ] **UX polish + accessibility pass**
  - Keyboard navigation in quiz and flashcard study flows.
  - Clearer error states for quiz generation failures + retries (already partially implemented in `src/components/quizzes/QuizView.tsx`).

## Notes

- Authoritative “done” descriptions appear to live under `docs/completed/`.
- If you want, I can also generate a smaller “release checklist” variant (what to do before shipping) separate from this engineering TODO list.

