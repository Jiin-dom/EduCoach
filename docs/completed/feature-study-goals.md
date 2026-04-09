## Feature: Study Goals (Completed)

This document summarizes the implementation of the Study Goals feature, which allows users to set specific target dates for documents and assessments to track their learning progress.

---

## 1. High-Level Overview

- **Goal**: Provide a dashboard for users to manage their study schedule by setting "File Study Goals" and "Quiz Deadlines".
- **Architecture**:
  - **Database**: Utilizes `exam_date` and `deadline` columns in the `documents` table.
  - **UI Components**:
    - `StudyGoalsPanel`: Central dashboard for goals and upcoming targets.
    - `SetGoalDialog`: Unified form for setting dates for both files and quizzes.
    - `ExamManager`: Sidebar component showing a summary of upcoming targets.
  - **Integration**: Goals are integrated into the learning intelligence engine to prioritize overdue topics.

---

## 2. Database Schema

The feature leverages existing and new columns in the `documents` table.

| Column | Type | Purpose |
|--------|------|---------|
| `exam_date` | `TIMESTAMPTZ` | Stores the target date for finishing a specific document (File Study Goal). |
| `deadline` | `TIMESTAMPTZ` | Stores the target date for completing associated assessments (Quiz Deadline). |

- **Migration**: `supabase/migrations/20240328000001_add_exam_date_to_documents.sql` added the `exam_date` column.
- **Migration**: `supabase/migrations/012_add_deadline_to_documents.sql` added the `deadline` column.

---

## 3. Frontend Implementation

### 3.1. Study Goals Dashboard (`src/components/learning-path/StudyGoalsPanel.tsx`)
The main interface for managing goals. It categorizes targets into:
- **File Study Goals**: Targeted dates for document mastery.
- **Quiz Deadlines**: Deadlines for specific quizzes (mapped to the parent document's `deadline` field).

### 3.2. Goal Management logic
- **Setting Goals**: Users can use the `SetGoalDialog` to pick a date. The logic uses the `useUpdateDocument` hook to update the `documents` table.
- **Tracking Progress**: For Quiz Goals, the system displays the latest score from `useUserAttempts` to show mastery progress.
- **Overdue Detection**: A helper function `daysRemaining` calculates the delta between today and the target date, applying visual styles (red/warning) to overdue items.

### 3.3. Exam Manager Sidebar (`src/components/learning-path/ExamManager.tsx`)
A summary view that aggregates all active goals, sorted by proximity to the current date. It provides a quick glance at "Upcoming Targets" with day counts (e.g., "3d left", "Today").

---

## 4. Files Created/Modified

| File | Purpose |
|------|---------|
| `src/components/learning-path/StudyGoalsPanel.tsx` | Main feature dashboard and card components. |
| `src/components/learning-path/ExamManager.tsx` | Summary sidebar for tracking upcoming targets. |
| `src/hooks/useDocuments.ts` | Updated `Document` type to include `exam_date`. |
| `supabase/migrations/20240328000001_add_exam_date_to_documents.sql` | Database migration for `exam_date`. |

---

## 5. Verification Checklist

- [ ] Navigate to "Learning Path" -> "Study Goals".
- [ ] Click "Set New Goal" and verify the dialog allows selecting between File and Quiz.
- [ ] Set a File Goal and verify it appears in the "File Study Goals" column.
- [ ] Set a Quiz Deadline and verify it appears in the "Quiz Deadlines" column.
- [ ] Verify the "Upcoming Targets" sidebar updates in real-time.
- [ ] Remove a goal using the trash icon and verify the database record is cleared.
