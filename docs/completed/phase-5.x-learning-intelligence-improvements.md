# Phase 5.x: Learning Intelligence Quality Upgrade

**Status:** Implemented  
**Date:** March 7, 2026  
**Scope:** Bug fixes, error handling, flashcard-mastery integration, learning config wiring, analytics enrichment, profile real data

## Problem Statement

After Phase 5 implemented WMS mastery scoring, SM-2 spaced repetition, global priority scheduling, and wired real data to dashboard/analytics/learning-path UI, several bugs and quality gaps remained compared to the standard set by Phase 3.5-3.9 and Phase 4.x:

1. `time_spent_seconds` always null in `question_attempt_log` -- QuizView tracked total time but never passed per-question time to the learning engine
2. `attempt_index` always defaulted to 1 -- never computed per concept
3. SM-2 due dates mixed UTC and local time, causing off-by-one errors near midnight
4. Study streak calculation mixed UTC attempt dates with local "today"
5. TodaysStudyPlan progress bar hardcoded to `value={0}`
6. MotivationalCard used hardcoded `const streak = 5`
7. ProfileContent was entirely mock data (streak=5, quizzesCompleted=48, etc.)
8. Flashcard reviews (Phase 3.8) did not update concept mastery -- two separate learning systems
9. `learning_config` table existed but was never read -- all algorithm weights hardcoded
10. No error handling for `processQuizResults` -- silent failures
11. No toast notifications for learning engine events
12. No time-series analytics, no real charts, no activity heatmap
13. No concept-level drill-down in analytics

## Changes Made

### Phase 5.1: Bug Fixes

**learningAlgorithms.ts:**
- Implemented `timeWeight` in `calculateAttemptScore` -- fast correct answers (<=15s) get 1.1x bonus, slow answers (>120s) get 0.85x penalty, unknown time defaults to 1.0
- Fixed `calculateSM2` to use `setUTCDate` instead of `setDate` for due date computation
- Fixed `calculatePriorityScore` to use UTC date parsing instead of local `T00:00:00`
- Added `todayUTC()` helper for consistent UTC date string generation
- `computeMastery` now accepts configurable `confidenceK` parameter

**useLearning.ts:**
- `ProcessQuizResultsInput` now includes optional `timePerQuestion: Record<string, number>`
- Mutation computes `attempt_index` per concept by querying existing log counts before insertion
- `time_spent_seconds` now populated from `timePerQuestion` map
- `useDueTopics` uses `todayUTC()` instead of `new Date().toISOString().split('T')[0]`
- Study streak calculation uses UTC-only date arithmetic

**QuizView.tsx:**
- Added `questionStartRef` and `questionTimeMap` refs for per-question time tracking
- `handleNext`, `handlePrevious`, and `handleSubmit` all call `recordQuestionTime()` before transitioning
- `processQuizResults.mutate()` now passes `timePerQuestion` map
- Retake resets question time tracking

**TodaysStudyPlan.tsx:**
- Progress bar now shows real completion percentage (reviewed today / total due topics)
- Uses `useConceptMasteryList` to check `last_reviewed_at` against today's date

**MotivationalCard.tsx:**
- Replaced `const streak = 5` with `useLearningStats().studyStreak`
- Rotates through motivational quotes based on streak count

### Phase 5.2: Error Handling and UX Resilience

**Installed `sonner` for toast notifications:**
- Added `<Toaster>` component to `main.tsx` root

**useLearning.ts:**
- `onSuccess` now shows success toast: "Mastery scores updated -- N concepts updated"
- `onError` now shows warning toast: "Learning progress could not be updated"

**ReadinessScoreCard.tsx:**
- Added `isLoading` skeleton state with spinner

**AnalyticsContent.tsx:**
- Added error state card with amber AlertTriangle when stats or mastery queries fail
- Renders friendly "Could not load analytics" message

**LearningPathContent.tsx:**
- Added error state with retry button when mastery or stats queries fail

### Phase 5.3: Flashcard-Mastery Integration

**useLearning.ts:**
- Extracted `recomputeConceptMastery()` as a shared standalone function
- Used by both `useProcessQuizResults` mutation and `useReviewFlashcard`
- Refactored quiz mutation's inner loop to call `recomputeConceptMastery`

**useFlashcards.ts:**
- After `useReviewFlashcard` updates the flashcard's SM-2 state, it now:
  1. Inserts a `question_attempt_log` entry for the linked `concept_id` with `source_type='flashcard'`
  2. Uses `flashcard_id` for source-aware logging (no fake quiz/question IDs)
  3. Computes concept-scoped `attempt_index` from prior concept history
  4. Fails fast on insert errors before recomputing mastery
  5. Calls `recomputeConceptMastery` with loaded learning config
  6. Invalidates learning query caches alongside flashcard caches
- Both quiz attempts AND flashcard reviews now feed into `user_concept_mastery`

**Database migration (post-Phase 5.x hardening):**
- Added `supabase/migrations/013_question_attempt_log_source_split.sql`
- `question_attempt_log` now supports both quiz and flashcard events:
  1. New `source_type` (`quiz` / `flashcard`)
  2. New `flashcard_id` FK
  3. `question_id`, `quiz_id`, `attempt_id` are conditionally required via source-specific `CHECK` constraints
  4. Existing rows are backfilled to `source_type='quiz'`

### Phase 5.4: Learning Config Integration

**useLearning.ts:**
- Added `LearningConfig` interface and `DEFAULT_CONFIG` constant
- Added `useLearningConfig()` query hook -- fetches from `learning_config` table, falls back to defaults
- Added shared `loadLearningConfigForUser()` loader for mutation paths
- `useProcessQuizResults` now loads config once per mutation and uses config thresholds for score→quality mapping
- `recomputeConceptMastery` now consistently applies config for confidence saturation, SM-2 defaults, priority weights, and mastery thresholds
- Added `learningKeys.config()` query key

### Phase 5.5: Analytics Enrichment

**useLearning.ts -- new hooks:**
- `useScoreTrend()` -- returns daily average quiz scores for the last 30 days (for LineChart)
- `useStudyActivity()` -- returns per-day question counts for the last 90 days (for heatmap)

**Installed `recharts` for proper data visualization**

**AnalyticsContent.tsx -- full rewrite:**
- **Activity Heatmap**: GitHub-style 90-day heatmap showing questions answered per day with 5-level green intensity
- **Performance by Document**: Horizontal `BarChart` (recharts) replacing CSS bars
- **Mastery Distribution**: `PieChart` (recharts) with donut style replacing CSS bar chart
- **Score Trend** (new tab): `LineChart` showing daily average quiz scores over 30 days
- **All Concepts list**: Clickable concept rows that open drill-down view
- **Concept Drill-Down**: Detailed analytics card showing mastery, confidence, total/correct attempts, due date, interval, ease factor, and category
- **Weak Topics**: Now clickable -- clicking opens drill-down
- 4-tab layout: Performance, Trends, Weak Topics, Quiz History

### Phase 5.6: Profile Page Real Data

**ProfileContent.tsx -- full rewrite:**
- Profile overview uses `useAuth().profile` for display name, email, study goal, daily target
- Avatar initials derived from display name
- Join date from `user.created_at`
- Quick stats (streak, quizzes completed) from `useLearningStats()`
- Materials count from `useDocuments()`
- Learning insights computed from real `useConceptMasteryList()` data:
  - Best Subject: category with highest average mastery
  - Needs Improvement: category with lowest average mastery
  - Concepts Tracked: total from learning stats
  - Readiness Score: average mastery from learning stats
- Preferred subjects displayed from profile data
- Loading state with spinner for stats section

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/learningAlgorithms.ts` | Time weight, UTC timezone fixes, `todayUTC()`, configurable confidence K |
| `src/hooks/useLearning.ts` | Time per question, attempt_index, UTC fixes, toast notifications, `recomputeConceptMastery`, `useLearningConfig`, mutation config wiring, source-aware quiz attempt logs, `useScoreTrend`, `useStudyActivity` |
| `src/hooks/useFlashcards.ts` | Source-aware flashcard attempt logging, concept attempt index, fail-fast insert behavior, mastery recompute with loaded config |
| `supabase/migrations/013_question_attempt_log_source_split.sql` | Source-aware `question_attempt_log` schema for quiz + flashcard events |
| `src/components/quizzes/QuizView.tsx` | Per-question time tracking, pass `timePerQuestion` to learning engine |
| `src/components/dashboard/TodaysStudyPlan.tsx` | Real progress bar based on reviewed-today vs due |
| `src/components/dashboard/MotivationalCard.tsx` | Real streak from `useLearningStats()`, rotating quotes |
| `src/components/dashboard/ReadinessScoreCard.tsx` | Loading state with spinner |
| `src/components/analytics/AnalyticsContent.tsx` | Full rewrite with recharts, heatmap, trends, drill-down, error states |
| `src/components/learning-path/LearningPathContent.tsx` | Error state with retry button |
| `src/components/profile/ProfileContent.tsx` | Full rewrite with real data from auth, learning, and documents |
| `src/main.tsx` | Added `<Toaster>` from sonner |

## Dependencies Added

| Package | Purpose |
|---------|---------|
| `sonner` | Toast notifications |
| `recharts` | Charts (BarChart, LineChart, PieChart) |

## Deployment

1. Run `npm install` to get new dependencies (sonner, recharts)
2. Frontend rebuilds automatically (Vite HMR or `npm run build`)
3. Apply database migration `013_question_attempt_log_source_split.sql`
4. No Edge Function or NLP service changes required for this phase-level patch

## Backward Compatibility

- All new algorithm parameters have defaults matching the original hardcoded values
- `ProcessQuizResultsInput.timePerQuestion` is optional -- existing callers continue to work
- `computeMastery(attempts)` still works without the new `confidenceK` parameter
- `recomputeConceptMastery` config parameter is optional with sensible defaults
- Flashcard mastery integration is additive -- flashcards without `concept_id` are unaffected
- `learning_config` table is read but never required -- defaults used when row is missing
- Existing quiz attempt rows remain valid after migration because `source_type='quiz'` is backfilled/defaulted
