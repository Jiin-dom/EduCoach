## Feature: Exam Dates & Learning Intelligence (Completed)

This document describes the shipped exam-date behavior in EduCoach and where it is surfaced in the learning path.

---

## 1. High-Level Overview

- **Goal**: Let students set a hard target date for a document and use that date to pull study work forward.
- **Key logic**: `exam_date` acts as a cap on concept due dates when the normal SM-2 review interval would land after the target date.
- **Current product scope**: Exam dates are managed from the learning-path goals flow and file-level study actions. They are not collected during initial profiling.

---

## 2. Learning Intelligence Integration (`src/hooks/useLearning.ts`)

The `exam_date` is factored into the concept mastery list and due-topic calculations.

### 2.1. Effective Due Date Calculation

When fetching the mastery list (`useConceptMasteryList`), the system computes an effective due date:

1. It calculates the standard SM-2 `due_date`.
2. If the associated document has an `exam_date`:
   - it compares the calculated `due_date` with the `exam_date`
   - if the review would land after the exam date, the due date is pulled forward to the exam date

### 2.2. Priority Scoring

The effective due date feeds the `priority_score` calculation:

- concepts closer to or past the effective due date receive more urgency
- exam-dated material therefore rises earlier in the learning path and generated study work

---

## 3. Database Schema

| Table | Column | Type | Description |
|-------|--------|------|-------------|
| `documents` | `exam_date` | `TIMESTAMPTZ` | The target date for finishing the document's material before the real exam or deadline. |

- **Migration**: The app relies on the existing `documents.exam_date` column. No new schema work is required for the current behavior.

---

## 4. UI Components

### 4.1. Goal Management

Students currently set or edit exam dates from shipped goal-management surfaces:

- `src/components/learning-path/StudyGoalsPanel.tsx`
- `src/components/files/StudyHeader.tsx`

### 4.2. Learning Path Display

The learning path uses exam dates in two ways:

- performance-backed concepts inherit urgency through their adjusted due date and priority
- baseline goal-window placeholders appear as planned study work before any attempts exist

The calendar and generated plan surfaces also show file-goal markers tied to `exam_date`.

---

### 4.1. Setting Exam Dates

Exam dates (study goals) are assigned per-document and are not part of the initial user profiling phase. They can be set in two primary ways:

1. **File Upload Dialog** (`src/components/files/FileUploadDialog.tsx`): Users can optionally set a "Study Goal (Completion Date)" during the initial upload of a document.
2. **Study Goals Panel** (`src/components/learning-path/StudyGoalsPanel.tsx`): Users can use the "Set New Goal" button or the edit icon on existing documents to set or update the `exam_date` via the `SetGoalDialog`. This is located in the **Learning Path** under the **Goals & Planning** tab.

### 4.2. Learning Path Calendar & Management
The `LearningPathCalendar` and `ExamManager` components utilize the `exam_date` to provide visual countdowns and alerts for upcoming exams. 

- **Exam Manager**: Viewable in the "Goals & Planning" tab, it aggregates all active study goals sorted by proximity.
- **Study Goals Panel** (`src/components/learning-path/StudyGoalsPanel.tsx`): Displays **Goal Readiness** (Low, Medium, High) for both Document Goals and Quiz Deadlines. This readiness is calculated by averaging the current mastery scores of the concepts associated with the document, rather than showing a simple quiz score. This provides a real-time indicator of the user's preparedness for their target date.
## 5. What Is Not Included

- Initial profiling does **not** collect exam dates today.
- Exam dates do **not** create a full manual planner. In v1 they drive generated scheduling, visible goal markers, and replanning.

---

## 6. Verification Checklist

- [ ] Set an `exam_date` on a document from the learning-path goals flow or file header.
- [ ] Confirm the document appears as a file goal on the learning path.
- [ ] Confirm baseline planned study items appear even if the student has not taken a quiz yet.
- [ ] Confirm concepts tied to the document become due no later than the exam date.
- [ ] Confirm changing the exam date refreshes the learning path and calendar without a manual page reload.
