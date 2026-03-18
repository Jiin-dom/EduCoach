# Phase 6: Advanced Learning Intelligence

**Status:** Implemented  
**Date:** March 7, 2026  
**Scope:** Adaptive quiz generation, mastery decay, learning path UX, analytics enhancements, unit tests

## Problem Statement

After Phase 5.x established WMS mastery scoring, SM-2 spaced repetition, analytics charts, and wired real data to all UI surfaces, several intelligence gaps remained:

1. Quiz generation was completely **blind to mastery** — a user who already mastered "Arrays" still got the same number of Arrays questions as someone who had never seen them
2. Mastery scores were **static** — a user who scored 100% three months ago still showed "Mastered" even if they'd likely forgotten the material
3. The Learning Path was informational but not **actionable** — users could see what they needed to study but couldn't take action directly from the page
4. Analytics had score trends and activity heatmaps but no **mastery over time** visualization, no study efficiency metrics, and no concept velocity tracking
5. **Zero test coverage** on the mathematical core of the system (WMS, SM-2, priority scoring, decay)

## Changes Made

### Phase 6.1: Adaptive Quiz Generation (Mastery-Aware)

**supabase/functions/generate-quiz/index.ts:**
- `GenerateQuizRequest` now accepts optional `userId` and `focusConceptIds` parameters
- Before building the NLP payload, queries `user_concept_mastery` for the user's mastery data on all document concepts
- Each concept classified as weak (< 60), developing (60-79), or strong (>= 80)
- Passes `mastery_context` array to the NLP service payload with per-concept mastery level, score, and adaptive difficulty
- Per-chunk question quotas adjusted: 2x for chunks containing weak concepts, 0.5x for chunks where all concepts are mastered
- Adaptive difficulty mapping: weak → beginner, developing → intermediate, strong → advanced
- When `focusConceptIds` provided, filters to only those concepts (for targeted review quizzes)
- Review quizzes get prefixed title: "Review Quiz: {document title}"

**src/hooks/useQuizzes.ts:**
- Added `GenerateReviewQuizInput` interface with `documentId`, `focusConceptIds`, and optional `questionCount`
- Added `useGenerateReviewQuiz()` mutation — invokes the generate-quiz Edge Function with `focusConceptIds` and the authenticated user's ID

### Phase 6.2: Mastery Decay

**src/lib/learningAlgorithms.ts:**
- Added `calculateMasteryWithDecay(mastery, dueDate, intervalDays, maxDecay)` — applies time-based decay to displayed mastery when a concept is overdue for review
  - If not overdue: mastery unchanged
  - `overdueFactor = min(1, daysOverdue / (intervalDays × 3))`
  - `decayedMastery = mastery × (1 - 0.15 × overdueFactor)`
  - Max 15% penalty even for severely overdue items
  - Longer intervals (well-learned items) are more forgiving
- Added `getMasteryLevelWithDecay(mastery, confidence, dueDate, intervalDays)` — wraps `getMasteryLevel` with the decayed value

**src/hooks/useLearning.ts:**
- `useConceptMasteryList()` now applies `getMasteryLevelWithDecay` to produce `display_mastery_score` and `display_mastery_level` for each mastery row
- `useLearningStats()` uses decayed values for aggregated stats (mastered/developing/needs_review counts and average mastery)
- `ConceptMasteryWithDetails` type extended with `display_mastery_score` and `display_mastery_level` fields
- UI components consume display values; raw `mastery_score` remains untouched in the database

### Phase 6.3: Learning Path UX Improvements

**src/hooks/useLearningProgress.ts (NEW):**
- `useWeeklyProgress()` hook — queries `question_attempt_log` for the last 7 days
- Computes: concepts improved (unique concepts with correct answers), new concepts tracked (mastery rows created this week), questions answered, quizzes completed

**src/components/learning-path/LearningPathContent.tsx:**
- **Weekly Progress Summary card** — gradient card above the sections showing "This Week's Progress" with concepts improved, new concepts tracked, questions answered, quizzes completed
- **"Start Review" button** — appears in the header when due/weak concepts exist; on click, collects concept IDs from "Due Today" and "Needs Review" sections, groups by document, picks the document with the most reviewable concepts, generates a targeted review quiz, and navigates to it
- **Concept Detail Dialog** — clicking any topic card opens a dialog showing mastery %, confidence, SM-2 due date, interval, ease factor, stored vs. displayed mastery, accuracy, attempt count, last reviewed date, and priority score; includes a decay explanation callout when display mastery is lower than stored mastery
- **Fixed broken code:** Removed duplicate dead TopicCard return statement, orphaned SectionBlock duplicate block, and garbled `concept========` prop from a bad merge

### Phase 6.4: Analytics Enhancements

**supabase/migrations/011_mastery_snapshots.sql (NEW):**
- Created `mastery_snapshots` table: `id` (UUID PK), `user_id` (FK), `concept_id` (FK), `mastery_score` (NUMERIC 5,2), `mastery_level` (TEXT), `recorded_at` (TIMESTAMPTZ)
- Composite index on `(user_id, concept_id, recorded_at DESC)` for efficient per-concept timeline queries
- Index on `(user_id, recorded_at DESC)` for efficient global timeline queries
- RLS policies: users can read and insert their own snapshots only

**src/hooks/useLearning.ts — snapshot insertion:**
- `recomputeConceptMastery()` now inserts a `mastery_snapshots` row after each successful mastery upsert
- Insert is non-fatal — logs a warning but does not break mastery computation if table doesn't exist yet

**src/hooks/useLearning.ts — new hooks:**
- `useMasteryTimeline(conceptId?)` — queries `mastery_snapshots` for the last 30 days, groups by day, averages scores; returns `{ date, mastery }[]` for LineChart; if `conceptId` provided, returns single-concept timeline
- `useStudyEfficiency()` — cross-references `question_attempt_log` time data with mastery scores and concept categories; returns total study time (minutes), average mastery, most efficient category, and per-category breakdown
- `useConceptVelocity()` — analyzes mastery snapshot history to calculate average days from first tracked attempt to "developing" and to "mastered" levels

**src/components/analytics/AnalyticsContent.tsx:**
- **Mastery Over Time chart** (Trends tab) — purple LineChart showing daily average mastery across all concepts over 30 days, with empty state guidance
- **Concept drill-down timeline** — when clicking a concept in Performance tab, the detail card now includes a per-concept mastery timeline chart
- **Study Efficiency card** (Trends tab) — shows total study time, average mastery, most efficient category callout, and per-category time/mastery breakdown
- **Concept Velocity card** (Trends tab) — shows average days to reach "developing" and "mastered" levels, with explanatory text

### Phase 6.5: Unit Tests for Learning Algorithms

**vitest.config.ts (NEW):**
- Basic Vitest configuration using the existing Vite config

**src/lib/learningAlgorithms.test.ts (NEW):**
- 10 test suites covering every pure function:
  1. `calculateAttemptScore` — correct/wrong, all difficulties, time weights, null handling
  2. `calculateTopicMastery` — 0/1/2/3+ attempts, recency weighting, mixed results
  3. `calculateConfidence` — boundary values at 0, 1, 2, 3, 10 attempts, custom K
  4. `calculateFinalMastery` — baseline blending at various confidence levels
  5. `getMasteryLevel` — all level boundaries, confidence threshold for mastered
  6. `computeMastery` — full pipeline: single wrong, single correct, 3 correct, recovery scenarios
  7. `mapScoreToQuality` — all SM-2 quality boundaries
  8. `calculateSM2` — first/second/third+ reviews, quality < 3 reset, ease factor floor, quality clamping, date validation
  9. `calculatePriorityScore` — overdue vs future, low vs high mastery, low vs high confidence, clamping
  10. `calculateMasteryWithDecay` + `getMasteryLevelWithDecay` — not overdue, slightly overdue, severely overdue, max decay cap, interval scaling, never below 0, level downgrade
- Helper tests: `conceptAccuracyPercent`, `todayUTC`
- SM-2 progression sequence: consistent quality 4 pattern, failure-and-recovery

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/011_mastery_snapshots.sql` | Mastery snapshots table for timeline analytics |
| `src/hooks/useLearningProgress.ts` | Weekly progress hook for Learning Path summary |
| `src/lib/learningAlgorithms.test.ts` | Unit tests for all learning algorithm functions |
| `vitest.config.ts` | Vitest test runner configuration |

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/generate-quiz/index.ts` | Mastery-aware adaptive quiz generation, review quiz support |
| `src/hooks/useQuizzes.ts` | `GenerateReviewQuizInput`, `useGenerateReviewQuiz()` mutation |
| `src/hooks/useLearning.ts` | Mastery decay in queries, snapshot insertion, `useMasteryTimeline`, `useStudyEfficiency`, `useConceptVelocity` hooks |
| `src/lib/learningAlgorithms.ts` | `calculateMasteryWithDecay`, `getMasteryLevelWithDecay` |
| `src/components/learning-path/LearningPathContent.tsx` | Weekly progress card, Start Review button, concept detail dialog, dead code cleanup |
| `src/components/analytics/AnalyticsContent.tsx` | Mastery Over Time chart, concept timeline in drill-down, Study Efficiency card, Concept Velocity card |
| `src/components/dashboard/TodaysStudyPlan.tsx` | Minor adjustments for decay-aware display values |
| `src/lib/supabase.ts` | Minor type adjustments |
| `package.json` / `package-lock.json` | Added `vitest` dev dependency |

## Dependencies Added

| Package | Purpose |
|---------|---------|
| `vitest` | Unit test runner for learning algorithm tests |

## Deployment

1. Run `npm install` to get vitest
2. **Apply database migration:** Run `011_mastery_snapshots.sql` in Supabase SQL Editor
3. **Redeploy Edge Function:** `npx supabase functions deploy generate-quiz` (for mastery-aware generation)
4. Frontend rebuilds automatically (Vite HMR or `npm run build`)
5. NLP service does not require changes — it receives `mastery_context` but gracefully ignores unknown fields

## Verification

### Automated Tests
```bash
cd educoach
npx vitest run src/lib/learningAlgorithms.test.ts
```

### Manual Verification
1. **Adaptive Quiz:** Upload a document, take a quiz (get some wrong), generate a second quiz — verify more questions on weak concepts
2. **Mastery Decay:** Set a concept's `due_date` to 14 days ago in Supabase dashboard, refresh Learning Path — verify displayed mastery is lower
3. **Start Review:** Verify button appears when due/weak concepts exist, click it, verify targeted quiz is generated
4. **Concept Detail:** Click a topic card in Learning Path, verify all SM-2 metadata is shown
5. **Mastery Over Time:** Take 2+ quizzes, check Trends tab for the purple mastery timeline chart
6. **Study Efficiency:** Check Trends tab for time vs mastery card
7. **Concept Velocity:** Check Trends tab for days-to-developing and days-to-mastered metrics

## Backward Compatibility

- `GenerateQuizRequest.userId` and `focusConceptIds` are optional — existing quiz generation callers are unaffected
- Mastery decay is display-only — stored `mastery_score` values remain unchanged in the database
- Mastery snapshot insertion is non-fatal — if the `mastery_snapshots` table hasn't been created yet, mastery computation still works
- All new analytics hooks return empty/null data gracefully when no snapshots exist yet
- Unit tests are development-only — no production impact
