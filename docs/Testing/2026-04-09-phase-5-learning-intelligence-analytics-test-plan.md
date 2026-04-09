# Phase 5 Learning Intelligence & Analytics Test Plan

- Date: 2026-04-09
- Feature area: Learning engine, learning path, study goals, analytics, dashboard learning summaries
- Dependency map: `educoach/docs/info/dependency-maps/phase-5-learning-intelligence-analytics-dependency-map.md`
- Current routes: `/learning-path`, `/analytics`

## Cross-checked scope

This plan is based on:

- `src/hooks/useLearning.ts`
- `src/lib/learningAlgorithms.ts`
- `src/components/learning-path/LearningPathContent.tsx`
- `src/components/learning-path/LearningPathCalendar.tsx`
- `src/components/learning-path/StudyGoalsPanel.tsx`
- `src/components/analytics/AnalyticsContent.tsx`
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
  - analytics cards/charts load
  - no premium guard blocks access

### 7. Dashboard learning summaries

- Open dashboard cards that depend on learning stats.
- Expected:
  - readiness, due topics, weak topics, and motivational summaries render from the same current learning data

## Edge cases

- no attempts yet
- no goal-dated documents
- quiz completion updates only some concepts
- concept has zero attempts but still has a scheduled due date
- partial replanning success across multiple goal-dated documents
- non-premium user attempts to open `/analytics`

## Validation points

- learning-path sections and calendar stay consistent after a quiz, goal edit, or replan
- analytics gating is enforced by `ProtectedRoute requirePremium`
- generated baseline work is visible before attempt history exists

## Pass criteria

- The learning engine updates all dependent surfaces after quiz activity.
- Learning Path, analytics, goals, and dashboard summaries stay coherent.
