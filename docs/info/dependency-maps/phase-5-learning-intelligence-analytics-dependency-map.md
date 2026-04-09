# Phase 5 Learning Intelligence & Analytics Dependency Map

Last cross-checked: 2026-04-02

**Source docs checked**
- `educoach/docs/completed/phase-5-learning-intelligence-and-analytics.md`
- `educoach/docs/completed/phase-5.x-learning-intelligence-improvements.md`
- `educoach/docs/completed/phase-6.2-advanced-learning-intelligence.md`
- `educoach/docs/info/learning_path_explained.md`
- `educoach/docs/completed/feature-assign-deadline.md`

**Primary current entry points**
- `/learning-path`
- `/analytics`
- dashboard cards and profile summary widgets

## Current Dependency Flow

```text
QuizView.tsx
  -> useSubmitAttempt()
  -> useProcessQuizResults()
      -> hooks/useLearning.ts
          -> lib/learningAlgorithms.ts
          -> services/goalWindowScheduling.ts
          -> Supabase mastery/log tables

LearningPathPage.tsx
  -> LearningPathCalendar.tsx
  -> LearningPathContent.tsx
  -> StudyGoalsPanel.tsx

AnalyticsPage.tsx
  -> AnalyticsContent.tsx
```

## Current File Graph

| File | Responsibility | Direct feature dependencies |
|---|---|---|
| `src/hooks/useLearning.ts` | Central learning engine queries/mutations and mastery recompute path | `supabase`, `useAuth`, `services/goalWindowScheduling.ts`, `lib/learningAlgorithms.ts` |
| `src/lib/learningAlgorithms.ts` | Pure WMS, SM-2, priority, decay, and scoring math | consumed by learning + flashcards + dashboard |
| `src/components/learning-path/LearningPathContent.tsx` | Topic/mastery board and review-quiz entry point | `useConceptMasteryList`, `useLearningStats`, `useWeeklyProgress`, `useGenerateReviewQuiz` |
| `src/components/learning-path/LearningPathCalendar.tsx` | Calendar/schedule presentation | depends on learning-path data layer |
| `src/components/learning-path/StudyGoalsPanel.tsx` | Exam date/deadline planning and goal-window management | `useDocuments`, `useQuizzes`, `useUserAttempts`, `useGoalWindowScheduling`, `ExamManager.tsx` |
| `src/components/analytics/AnalyticsContent.tsx` | Analytics dashboards, charts, trend tabs, weak-topic views | `useUserAttempts`, `useQuizzes`, `useLearning` types/data |
| `src/hooks/useLearningProgress.ts` | Weekly progress query layer | `supabase`, `useAuth` |
| `src/components/dashboard/ReadinessScoreCard.tsx`, `TodaysStudyPlan.tsx`, `WeakTopicsPanel.tsx`, `MotivationalCard.tsx` | Dashboard summaries derived from the same mastery engine | `useLearningStats`, `useDueTopics`, `useWeakTopics` |
| `src/components/profile/ProfileContent.tsx` | Reuses learning stats + mastery summaries on profile page | `useLearningStats`, `useConceptMasteryList`, `useDocuments` |

## Supabase / Backend Touchpoints

- `public.question_attempt_log`
- `public.user_concept_mastery`
- `public.learning_config`
- `public.concepts`
- `public.documents`
- `public.attempts`
- `public.quizzes`
- `public.flashcards`

## Notes

- The historical “advanced learning intelligence” work extends the same dependency spine rather than creating a new subsystem.
- Deadline/exam-date scheduling now belongs to both phase 2 and phase 5: documents store the dates, but learning services consume them to assign `due_date` and `priority_score`.
