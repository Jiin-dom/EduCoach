## Phase 5 -- Learning Intelligence & Analytics (Completed)

This document summarizes what was implemented for Phase 5: WMS (Weighted Mastery Score), SM-2 spaced repetition scheduling, global scheduler for learning path prioritization, and real analytics data wired to all UI components.

---

## 1. High-Level Overview

- **Goal**: Make EduCoach adaptive -- compute per-concept mastery, schedule spaced reviews, prioritize weak topics, and replace all hardcoded mock data with real computed values.
- **Algorithms**: WMS for mastery scoring, SM-2 for review scheduling, Priority Score for global study ordering. Elo was excluded per project scope.
- **Architecture**: Client-side TypeScript computation (pure functions in `learningAlgorithms.ts`), with state persisted in Supabase via React Query hooks. No new Edge Functions needed -- all computation happens after quiz submission in the browser.

---

## 2. Database Schema (Migration `006_learning_intelligence.sql`)

Three new tables added:

### `question_attempt_log`

Per-question denormalized log. Every time a student answers a question, one row is inserted. This is the raw data that powers all analytics.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK -> auth.users | |
| `question_id` | UUID FK -> quiz_questions | |
| `quiz_id` | UUID FK -> quizzes | |
| `attempt_id` | UUID FK -> attempts | |
| `concept_id` | UUID FK -> concepts | Nullable, denormalized from quiz_questions |
| `document_id` | UUID FK -> documents | Denormalized from quiz |
| `is_correct` | BOOLEAN | |
| `user_answer` | TEXT | |
| `question_difficulty` | TEXT | beginner/intermediate/advanced |
| `time_spent_seconds` | INTEGER | For future use |
| `attempt_index` | INTEGER | Nth attempt for this concept |
| `attempted_at` | TIMESTAMPTZ | |

### `user_concept_mastery`

Stores WMS + SM-2 state per user per concept. Single source of truth for "how well does this student know this concept."

| Column | Type | Notes |
|--------|------|-------|
| `mastery_score` | NUMERIC(5,2) | 0-100, WMS final mastery |
| `confidence` | NUMERIC(3,2) | 0-1, based on attempt count |
| `mastery_level` | TEXT | needs_review / developing / mastered |
| `total_attempts` | INTEGER | |
| `correct_attempts` | INTEGER | |
| `repetition` | INTEGER | SM-2 repetition count |
| `interval_days` | INTEGER | SM-2 interval |
| `ease_factor` | NUMERIC(4,2) | SM-2 ease factor (starts 2.5) |
| `due_date` | DATE | SM-2 next review date |
| `priority_score` | NUMERIC(5,4) | 0-1, global scheduler output |

UNIQUE constraint on `(user_id, concept_id)`.

### `learning_config`

Tunable parameters for WMS weights, SM-2 defaults, and priority weights. One row per user with sensible defaults.

---

## 3. Learning Algorithms (`src/lib/learningAlgorithms.ts`)

Pure functions with zero side effects. The mathematical core.

### WMS Pipeline

1. **`calculateAttemptScore(isCorrect, difficulty)`** -- Score a single answer (0-1). Correct answers on harder questions score higher (DiffWeight: beginner=1.0, intermediate=1.1, advanced=1.2).

2. **`calculateTopicMastery(attempts[])`** -- Weighted average of the last 3 attempts using recency weights [1.0, 0.85, 0.70]. Returns 0-100.

3. **`calculateConfidence(attemptCount)`** -- `min(1, count/3)`. Prevents overconfidence from sparse data.

4. **`calculateFinalMastery(rawMastery, confidence)`** -- Blends with neutral baseline (50): `confidence * raw + (1-confidence) * 50`.

5. **`getMasteryLevel(finalMastery, confidence)`** -- Mastered (>=80 AND conf>=0.67), Developing (60-79), Needs Review (<60).

### SM-2 Calculator

- **`mapScoreToQuality(scorePercent)`** -- Maps quiz accuracy to SM-2 quality (0-5): >=90->5, 80-89->4, 65-79->3, 50-64->2, 30-49->1, <30->0.
- **`calculateSM2({quality, repetition, interval, easeFactor})`** -- Standard SM-2 algorithm. Quality>=3 advances schedule, <3 resets to day 1.

### Global Scheduler

- **`calculatePriorityScore(mastery, dueDate, confidence)`** -- `0.65*(1-mastery/100) + 0.25*deadlinePressure + 0.10*(1-confidence)`. Higher = study sooner.

---

## 4. React Query Hooks (`src/hooks/useLearning.ts`)

### Queries

- `useConceptMasteryList()` -- All mastery rows joined with concept name/category and document title
- `useConceptMasteryByDocument(docId)` -- Filtered by document
- `useDueTopics()` -- Concepts where due_date <= today, sorted by priority
- `useWeakTopics(limit)` -- Concepts with mastery_level = 'needs_review'
- `useLearningStats()` -- Aggregated stats: total concepts, mastered/developing/needs_review counts, average mastery, quizzes completed, average score, study streak

### Key Mutation

- `useProcessQuizResults()` -- Called after quiz submission. It:
  1. Fans out per-question answers into `question_attempt_log`
  2. For each affected concept: fetches recent logs, runs WMS pipeline, runs SM-2 update
  3. Upserts computed values into `user_concept_mastery`
  4. Invalidates all learning query caches

---

## 5. Integration Point: QuizView.tsx

The `handleSubmit` in `QuizView.tsx` was modified to chain the learning engine after attempt submission:

```
submitAttempt.mutate(attemptData, {
    onSuccess: (attempt) => {
        processQuizResults.mutate({
            attemptId: attempt.id,
            quizId, answers, questions, documentId
        })
    }
})
```

This ensures every completed quiz automatically updates mastery scores and review schedules.

---

## 6. UI Components Updated

### Dashboard (`DashboardContent.tsx`)
- Stats cards now show real data: study streak, quizzes completed, average score (from `useLearningStats`)

### Readiness Score (`ReadinessScoreCard.tsx`)
- Shows average mastery across all tracked concepts
- Shows total concepts tracked

### Weak Topics (`WeakTopicsPanel.tsx`)
- Fetches real weak concepts from `useWeakTopics(3)`
- Shows mastery percentage, progress bar, and link to source document

### Today's Study Plan (`TodaysStudyPlan.tsx`)
- Shows SM-2 due topics from `useDueTopics()`
- Sorted by priority score
- Links to source documents for review

### Analytics (`AnalyticsContent.tsx`)
- Overview: real stats (concepts tracked, quizzes, avg score, streak)
- Performance tab: mastery grouped by document with progress bars + mastery distribution chart
- Weak Topics tab: detailed weak concept list with confidence info
- Quiz History tab: real attempt history with scores and dates

### Learning Path (`LearningPathContent.tsx`)
- Priority-ranked topic list from the global scheduler
- Grouped into: Due Today, Needs Review, Developing, Mastered
- Each topic shows: mastery %, confidence %, days until due, source document
- Overall readiness progress bar

---

## 7. Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/006_learning_intelligence.sql` | 3 new tables |
| `src/lib/learningAlgorithms.ts` | Pure algorithm functions |
| `src/hooks/useLearning.ts` | React Query hooks |

## 8. Files Modified

| File | Change |
|------|--------|
| `src/components/quizzes/QuizView.tsx` | Wire quiz submission to learning engine |
| `src/components/dashboard/DashboardContent.tsx` | Real stats from useLearningStats |
| `src/components/dashboard/ReadinessScoreCard.tsx` | Real aggregate readiness |
| `src/components/dashboard/WeakTopicsPanel.tsx` | Real weak concepts |
| `src/components/dashboard/TodaysStudyPlan.tsx` | SM-2 due topics |
| `src/components/analytics/AnalyticsContent.tsx` | Full analytics rewrite |
| `src/components/learning-path/LearningPathContent.tsx` | Global scheduler output |

---

## 9. How to Deploy Phase 5

1. **Apply the database migration**: In Supabase SQL Editor, run `supabase/migrations/006_learning_intelligence.sql`
2. **Rebuild the frontend**: The new TypeScript files and modified components will be included automatically
3. **No new Edge Functions needed**: All computation is client-side

---

## 10. Verification Checklist

- Upload a document and generate a quiz (Phase 3+4 prerequisites)
- Take the quiz and submit answers
- Verify `question_attempt_log` rows appear in the database
- Verify `user_concept_mastery` rows are created/updated
- Check Dashboard: stats cards show real numbers
- Check ReadinessScoreCard: shows computed average mastery
- Check WeakTopicsPanel: shows actual weak concepts
- Check TodaysStudyPlan: shows due topics (all concepts start due today)
- Check Analytics page: all three tabs show real data
- Check Learning Path page: shows prioritized topic list grouped by mastery level
- Take the same quiz again: verify mastery scores update, SM-2 intervals advance
