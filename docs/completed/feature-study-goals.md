## Feature: Study Goals (Completed)

This document summarizes the shipped study-goals behavior for documents and assessments.

---

## 1. High-Level Overview

- **Goal**: Give students a place to manage document target dates and quiz deadlines from the learning path.
- **Architecture**:
  - **Database**: Uses `exam_date` and `deadline` on the `documents` table.
  - **UI components**:
    - `StudyGoalsPanel` for creating, editing, and removing goals
    - `ExamManager` for upcoming targets
    - `LearningPathCalendar` for goal markers and schedule edits
  - **Integration**: Goal changes invalidate learning-path, adaptive-study, document, and quiz queries so the page stays in sync.

---

## 2. Database Schema

| Column | Type | Purpose |
|--------|------|---------|
| `exam_date` | `TIMESTAMPTZ` | Stores the target date for finishing a document. |
| `deadline` | `TIMESTAMPTZ` | Stores the target date for assessments linked to the document. |

- **Schema status**: This feature uses existing document columns. No new schema change is required for the current implementation.

---

## 3. Frontend Implementation

### 3.1. Study Goals Dashboard (`src/components/learning-path/StudyGoalsPanel.tsx`)

The main management surface supports:

- creating file study goals
- creating quiz deadlines
- editing existing target dates
- removing target dates

### 3.2. Goal Tracking

- File goals are shown as document-level targets.
- Quiz deadlines are shown as assessment targets backed by the parent document's `deadline`.
- Upcoming targets are summarized in `ExamManager`.
- Goal markers are also rendered in the learning-path calendar and generated-plan sections.

### 3.3. Editing Scope in v1

“Edit Learning Path” is intentionally limited to shipped planner actions:

- edit file goals via `exam_date`
- edit quiz deadlines via `deadline`
- drag planned review dates in the calendar to reschedule concept due dates

This version does **not** include a full manual task planner for adaptive tasks.

---

## 4. Files Created/Modified

| File | Purpose |
|------|---------|
| `src/components/learning-path/StudyGoalsPanel.tsx` | Goal management dashboard and dialogs. |
| `src/components/learning-path/ExamManager.tsx` | Upcoming-target summary sidebar. |
| `src/components/learning-path/LearningPathCalendar.tsx` | Calendar view for goal markers and due-date rescheduling. |
| `src/hooks/useDocuments.ts` | Document updates now trigger learning-path related query refreshes. |
| `src/hooks/useGoalWindowScheduling.ts` | Shared replanning logic and invalidation support. |

---

## 5. Verification Checklist

- [ ] Navigate to Learning Path and open the goals/planning view.
- [ ] Create a file goal and confirm it appears in the goals list and calendar.
- [ ] Create a quiz deadline and confirm it appears in the goals list and calendar.
- [ ] Edit each target date and confirm the learning path refreshes automatically.
- [ ] Remove a goal and confirm the associated marker disappears.
- [ ] Drag a planned review to another day in the calendar and confirm the new date persists.
