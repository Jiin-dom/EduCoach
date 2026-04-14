# Phase 4 Quiz System Dependency Map

Last cross-checked: 2026-04-02

**Source docs checked**
- `educoach/docs/completed/phase-4-quiz-generation-and-attempts.md`
- `educoach/docs/completed/phase-4.x-quiz-ui-and-types(3-16-2026).md`
- `educoach/docs/completed/phase-4.x-quiz-generation-improvements.md`
- `educoach/docs/completed/feature-view-quiz-results.md`
- `educoach/docs/completed/2026-03-31-quiz-generation-supplement-import-fix.md`
- `educoach/docs/info/quiz-question-type-allocation-behavior.md`

**Primary current entry points**
- `/quizzes`
- `/quizzes/:id`
- quiz generation dialogs in `/files` and `/dashboard`

## Current Dependency Flow

```text
FilesContent.tsx / DashboardContent.tsx / QuizzesContent.tsx
  -> GenerateQuizDialog.tsx
      -> hooks/useGenerateQuiz()
          -> supabase.functions.invoke("generate-quiz")

pages/QuizSessionPage.tsx
  -> components/quizzes/QuizView.tsx
      -> useQuiz()
      -> useQuizQuestions()
      -> useSubmitAttempt()
      -> useQuizAttempts()
      -> useProcessQuizResults()
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/components/files/GenerateQuizDialog.tsx` | Main quiz-creation dialog and validation UI | `useGenerateQuiz`, `types/quiz.ts`, `lib/quizAllocation.ts` |
| `src/components/quizzes/QuizzesContent.tsx` | Quiz list/tabs, flashcard tab, new-quiz entry points | `useQuizzes`, `useUserAttempts`, `useAllFlashcards`, `GenerateQuizDialog`, `SelectDocumentDialog` |
| `src/components/quizzes/QuizView.tsx` | Quiz taking, completion, result display, regenerate flows | `useQuizzes` hooks, `useProcessQuizResults` |
| `src/components/dashboard/QuizCard.tsx` | Shared quiz card shown on dashboard/quizzes page | depends on quiz status and links to session/results |
| `src/components/quizzes/SelectDocumentDialog.tsx` | Quiz creation from the quizzes page | `useDocuments`, `formatFileSize` |
| `src/hooks/useQuizzes.ts` | Quiz/query/mutation layer for quizzes, questions, attempts, and generation | `supabase`, `ensureFreshSession`, `useAuth` |
| `src/types/quiz.ts` | Canonical quiz-type IDs and labels | used by dialog + allocation logic |
| `src/lib/quizAllocation.ts` | Balanced deterministic question-type target calculation | used by frontend dialog; mirrored by backend logic |
| `src/components/learning-path/LearningPathContent.tsx` | Generates review quizzes from weak concepts | `useGenerateReviewQuiz()` |

## Supabase / Backend Touchpoints

- `public.quizzes`
- `public.quiz_questions`
- `public.attempts`
- `supabase/functions/generate-quiz`
- `supabase/functions/generate-quiz/quizAllocation.ts`
- NLP `/generate-questions` path described in historical docs

## Notes

- “View quiz results” is no longer a separate branch in the UI tree; it is part of the same `QuizView.tsx` and `QuizCard.tsx` dependency chain that handles active and completed attempts.
- The supplement-import fix and question-allocation docs both land in the same modern dependency cluster: `GenerateQuizDialog.tsx`, `useQuizzes.ts`, `types/quiz.ts`, and backend `generate-quiz`.
