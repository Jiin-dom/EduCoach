# Distributed Learning Path Activities + Full-Concept Adaptive Quizzes

**Status:** Implemented  
**Date:** April 30, 2026  
**Scope:** Shared Supabase backend, web app, and mobile app -- 8 phases covering SQL migration, concept selection, virtual task distribution, bug fixes, post-quiz redistribution, and quiz naming

## Problem Statement

After document upload with a study goal/date, the learning path was distributing activities poorly:

1. The SQL function `sync_adaptive_study_tasks_for_document` capped concept selection at 5 urgent + 1 reinforcement, ignoring remaining document concepts
2. The web app had no virtual task distribution -- it only displayed raw DB tasks with no future planning
3. The mobile app had virtual tasks but with a hard-coded daily cap of 3 and no multi-concept quiz support
4. A confirmed bug in the auto-generation guard on both platforms caused future-dated quizzes to generate immediately
5. Quiz titles were generic ("Review Quiz: {doc}") with no concept-level context
6. Mobile was missing `adaptiveStudyKeys.all` cache invalidation after quiz completion

## Changes Made

### Phase 1: SQL Migration (shared backend)

**New file: `supabase/migrations/033_full_concept_adaptive_scheduling.sql`**

- Removed `LIMIT 5` from the `urgent` CTE in `sync_adaptive_study_tasks_for_document`
- Removed `LIMIT 1` from the `reinforcement` CTE
- ALL document concepts now flow into `adaptive_study_tasks.concept_ids`
- Updated quiz title pattern matching to recognize new prefixes (`Adaptive:`, `Baseline:`, `Review:`) alongside legacy `Review Quiz:`
- Updated `questionCount` metadata formula from `GREATEST(5, LEAST(12, ...))` to `GREATEST(10, LEAST(20, ...))`

### Phase 2: Service Layer -- Concept Selection Fix (both apps)

**Modified: `src/services/adaptiveStudy.ts` (web + mobile)**

- `pickFocusConceptIds()`: removed `.slice(0, 5)` cap on urgent concepts
- Changed `reinforcement` from `.find()` (single item) to `.filter()` (all qualifying)
- Updated `buildReviewQuestionCount()` from `max(5, min(12, n*2))` to `max(10, min(20, n*2))`
- Updated inline `questionCount` formula in auto-generation `useEffect` on both platforms

### Phase 3: Web Virtual Task Distribution (web only)

**Modified: `src/lib/learningPathPlan.ts`**

- Added `availableStudyDays` parameter to `buildLearningPathPlan()` input signature
- Added `clickable` property to `LearningPathAdaptiveTaskInput` interface
- Ported full virtual task generation system from mobile:
  - `createVirtualTask()` helper for single-concept tasks
  - `createMultiConceptVirtualTask()` helper for combined weak-topic quizzes
  - Mastery-based scheduling: `needs_review` (3-day sequence), `developing` (2-day), `mastered`/baseline (single day)
  - Multi-concept quiz frequency driven by weakness count (5+ weak = every day, 3+ = every 2 days, <3 = every 3 days)
  - Dynamic daily cap: `max(2, round(dailyStudyMinutes / 30))`
  - Deduplication of planned reviews vs virtual tasks
  - Empty study day gap-filling with alternating flashcards/reviews

**Modified: `src/hooks/useLearningPathPlan.ts`**

- Wired `availableStudyDays: profile?.available_study_days` into `buildLearningPathPlan()` call
- Added `profile?.available_study_days` to the `useMemo` dependency array

### Phase 4: Mobile Virtual Task Enhancement (mobile only)

**Modified: `src/lib/learningPathPlan.ts` (mobile)**

- Replaced all hard-coded `< 3` daily caps with dynamic `maxTasksPerDay` formula
- Added `createMultiConceptVirtualTask()` function
- Added multi-concept quiz scheduling after per-concept loop
- Improved gap-filling to alternate flashcards and reviews
- Updated single-concept quiz count from 5 to 10

### Phase 5: Web Virtual Task Crystallization (web only)

**Modified: `src/hooks/useAdaptiveStudy.ts`**

- Added `virtual-` prefix detection to `useRescheduleAdaptiveStudyTask`
- When a virtual task is rescheduled, it inserts a real `adaptive_study_tasks` row via Supabase (with `task_key: manual-{type}-{docId}-{timestamp}` and `virtualSourceId` metadata)
- Mirrors mobile's existing crystallization pattern

### Phase 6: Auto-Generation Guard Bug Fix (both apps)

**Modified: `src/pages/LearningPathPage.tsx` (web), `src/screens/LearningPathScreen.tsx` (mobile)**

- Fixed backwards condition: `task.scheduledDate > todayLocal ||` changed to `task.scheduledDate <= todayLocal &&`
- Before fix: a quiz scheduled for May 5 would auto-generate on April 30
- After fix: only tasks due today or overdue that haven't been completed today trigger generation

### Phase 7: Post-Quiz Activity Redistribution (mobile fix)

**Modified: `src/hooks/useLearning.ts` (mobile)**

- Added `queryClient.invalidateQueries({ queryKey: adaptiveStudyKeys.all })` to `useProcessQuizResults` `onSuccess` callback
- Web already had this invalidation; mobile was missing it
- Ensures adaptive task list refreshes after quiz completion, which triggers virtual task recalculation

### Phase 8: Quiz Naming (Edge Function + both apps)

**Modified: `supabase/functions/generate-quiz/index.ts`**

- New naming convention:
  - `Baseline: {concept1}, {concept2} & N more` (first quiz, no mastery data)
  - `Adaptive: {concept1}, {concept2} & N more` (post-baseline, has weak concepts)
  - `Review: {concept1}, {concept2} & N more` (post-baseline, all developing/mastered)
  - `Quiz: {document title}` (non-review quizzes, unchanged)

**Modified: `src/services/adaptiveStudy.ts` (web + mobile)**

- Replaced `REVIEW_QUIZ_TITLE_PREFIX` constant with `ADAPTIVE_QUIZ_TITLE_PREFIXES` array
- Updated `.ilike()` filter to `.or()` matching all prefixes

**Modified: `src/hooks/useAdaptiveQuizPolicies.ts` (web + mobile)**

- Aligned `isAdaptiveQuiz` on both platforms to check: `Adaptive:`, `Baseline:`, `Review:`, `Review Quiz:`, plus mobile's legacy `Adaptive quiz`

**Modified: `src/hooks/useAdaptiveStudy.ts` (web + mobile)**

- Updated fallback quiz question count formula to `max(10, min(20, ...))`

## Files Modified

| File | App | Phases |
|------|-----|--------|
| `supabase/migrations/033_full_concept_adaptive_scheduling.sql` | Supabase | 1, 8 |
| `src/services/adaptiveStudy.ts` | Web | 2, 8 |
| `src/services/adaptiveStudy.ts` | Mobile | 2, 8 |
| `src/lib/learningPathPlan.ts` | Web | 3 |
| `src/hooks/useLearningPathPlan.ts` | Web | 3 |
| `src/lib/learningPathPlan.ts` | Mobile | 4 |
| `src/hooks/useAdaptiveStudy.ts` | Web | 5, 8 |
| `src/hooks/useAdaptiveStudy.ts` | Mobile | 8 |
| `src/pages/LearningPathPage.tsx` | Web | 6, 2 |
| `src/screens/LearningPathScreen.tsx` | Mobile | 6, 2 |
| `src/hooks/useLearning.ts` | Mobile | 7 |
| `supabase/functions/generate-quiz/index.ts` | Edge Function | 8 |
| `src/hooks/useAdaptiveQuizPolicies.ts` | Web | 8 |
| `src/hooks/useAdaptiveQuizPolicies.ts` | Mobile | 8 |
| `src/lib/learningPathPlan.test.ts` | Web | Tests |

## Verification

### Automated Tests

```bash
cd educoach
npx vitest run src/lib/learningPathPlan.test.ts
```

13 tests pass, covering:

- Baseline vs performance planned review separation
- Goal marker generation for file goals and quiz deadlines
- Quiz deadline scoping
- Document deadline fallback for legacy quizzes
- Date-sorted calendar item ordering
- Date-based item grouping
- Virtual adaptive task creation for `needs_review` concepts
- Multi-concept quiz task generation for 5+ weak concepts
- Dynamic daily task cap based on `dailyStudyMinutes`
- No virtual tasks past document exam date
- Planned review deduplication against virtual tasks
- Empty study day gap-filling
- Virtual task `clickable` flag

### SQL Migration Deployment

Apply via Supabase CLI:

```bash
cd educoach
npx supabase db push
```

Or manually run `033_full_concept_adaptive_scheduling.sql` against the database. This is a non-destructive `CREATE OR REPLACE FUNCTION` -- existing tasks update on next sync.

### Manual Verification Checklist

1. Upload document with 6+ concepts and 10-day study goal -- verify distributed activities on both platforms
2. Take baseline quiz -- verify adaptive path covers ALL concepts (not just top 5)
3. Verify quiz titles show concept-based names (Baseline/Adaptive/Review)
4. Verify future quizzes are NOT auto-generated prematurely
5. After taking adaptive quiz -- verify calendar activities update to reflect new mastery scores
6. Verify daily task cap respects `daily_study_minutes` setting
