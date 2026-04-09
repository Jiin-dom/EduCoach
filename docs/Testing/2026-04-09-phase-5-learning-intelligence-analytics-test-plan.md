# Phase 5 Learning Intelligence & Analytics Test Plan

- Date: 2026-04-09
- Feature area: Learning engine, learning path, study goals, analytics, dashboard learning summaries
- Dependency map: `educoach/docs/info/dependency-maps/phase-5-learning-intelligence-analytics-dependency-map.md`
- Current routes: `/dashboard`, `/learning-path`, `/analytics`

## Cross-checked scope

This plan is based on:

- `src/hooks/useLearning.ts`
- `src/lib/learningAlgorithms.ts`
- `src/components/learning-path/LearningPathContent.tsx`
- `src/components/learning-path/LearningPathCalendar.tsx`
- `src/components/learning-path/StudyGoalsPanel.tsx`
- `src/components/analytics/AnalyticsContent.tsx`
- `src/components/dashboard/ProgressInsightsSection.tsx`
- `src/hooks/useLearningProgress.ts`
- `src/components/dashboard/ReadinessScoreCard.tsx`

## Core scenarios

### 1. Quiz completion updates learning engine

- Complete a quiz for a document with concepts.
- Expected:
  - attempt log updates
  - concept mastery updates
  - due dates and priority scores recompute
  - learning-path and dashboard summaries refresh

### 2. Learning Path main page

- Open `/learning-path`.
- Expected:
  - adaptive study queue loads when relevant
  - generated plan appears for goal-window placeholders and goal markers
  - four mastery sections remain attempt-backed

### 3. Learning Path calendar

- Open the calendar and check week/month views.
- Expected:
  - planned reviews, adaptive tasks, and goal markers appear on correct dates
  - drag-and-drop rescheduling works for planned reviews

### 4. Study goals management

- Create and edit:
  - a file goal via `exam_date`
  - a quiz deadline via `deadline`
- Expected:
  - goals appear in `StudyGoalsPanel`
  - `ExamManager` updates
  - calendar and generated plan refresh automatically

### 5. Review quiz entry from learning path

- Use the review action on the learning path for weak or due concepts.
- Expected:
  - a review quiz is generated
  - navigation lands on the quiz session correctly

### 6. Analytics premium page

- As a premium user, open `/analytics`.
- Expected:
  - advanced analytics cards/charts load
  - no premium guard blocks access

### 7. Dashboard progress insights for all students

- Open `/dashboard` as a non-premium user.
- Expected:
  - readiness percentage still appears
  - weak topics still appear
  - `Progress Insights` appears
  - score trend renders when score data exists
  - when exactly one scored quiz day exists, the latest score and date are called out visibly above the chart
  - 90-day activity heatmap renders when score trend is empty but activity exists
  - empty chart state renders when neither dataset exists

### 8. Dashboard topic mastery summary for all students

- Open `/dashboard` with attempt-backed mastery data.
- Expected:
  - `Topic Mastery` summary appears
  - dashboard shows only the top 2 study materials
  - rows are grouped by document
  - average mastery uses `display_mastery_score`
  - zero-attempt placeholders are excluded
  - if more than 2 materials exist, a `+N more` summary hint appears
  - CTA routes premium users to `/analytics` and non-premium users to `/subscription`

### 9. Dashboard learning summaries

- Open dashboard cards that depend on learning stats.
- Expected:
  - readiness, due topics, weak topics, progress insights, and motivational summaries render from the same current learning data

## Edge cases

- no attempts yet
- no goal-dated documents
- quiz completion updates only some concepts
- concept has zero attempts but still has a scheduled due date
- partial replanning success across multiple goal-dated documents
- non-premium user attempts to open `/analytics`
- score trend empty but activity heatmap present
- one quiz attempt only
- one scored quiz day should show a visible score summary, not just an isolated chart dot
- more than 2 mastery materials should keep the dashboard card capped and balanced
- premium trial user uses dashboard CTA and should reach `/analytics`

## Validation points

- learning-path sections and calendar stay consistent after a quiz, goal edit, or replan
- analytics gating is enforced by `ProtectedRoute requirePremium`
- generated baseline work is visible before attempt history exists
- dashboard exposes at least one progress chart path for every student state: score trend, activity fallback, or empty state

## Pass criteria

- The learning engine updates all dependent surfaces after quiz activity.
- Learning Path, analytics, goals, and dashboard summaries stay coherent.
- Non-premium students can view a progress chart and topic mastery summary without needing `/analytics`.
