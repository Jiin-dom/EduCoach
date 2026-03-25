## Feature: Study Goals (Pending)

This document summarizes the implementation architecture and functionality for the enhanced **Study Goals** feature, which allows users to set, track, and complete targeted learning milestones.

---

## 1. High-Level Overview

- **Goal**: Enable users to manage goals for their learning progress, specific to general application usage, individual topics, unique documents, or generated quizzes.
- **Architecture**:
  - **Supabase Database**: Uses the `study_goals` table populated with relevant foreign keys (`concept_id`, `document_id`, `quiz_id`) to link goals to content.
  - **React Frontend**: A dedicated `StudyGoalsPanel` in the Learning Path interface handles goal creation, progress evaluation, and visualization. Custom hooks in `useStudyGoals.ts` interface with the backend.

---

## 2. Database Schema (`supabase/migrations/013_study_goals.sql` & `015_add_study_goals_extensions.sql`)

The `study_goals` table was built to support multiple ways of defining a target:

- **Target Entities**:
  - `goal_type`: Constrained to `'topic_mastery'`, `'quiz_count'`, or `'overall_mastery'`.
  - `concept_id`: Reference to a specific concept for the `topic_mastery` goal type.
  - `document_id`: Reference to a specific document for the `topic_mastery` goal type.
  - `quiz_id`: Reference to a specific quiz for the `quiz_count` goal type.
- **Tracking Structure**:
  - `target_value`: The discrete number of completions or the percentage to reach.
  - `is_completed`: Boolean flag modified directly when the user finishes a goal.

---

## 3. Frontend UI (`src/components/learning-path/StudyGoalsPanel.tsx`)

The UI dynamically reflects a user's progress.

### 3.1. Goal Creation & Selection
- **Nested Selectors**: When creating a goal, users select a primary Goal Type. If they select Topic Mastery or Quiz Completion, they are given sub-options (via radio buttons) to narrow their goal to a generic count, a specific document, or a specific quiz.
- **Dynamic Options**: Form selectors automatically populate using `useDocuments()` and `useQuizzes()` so users can specify exactly which content they wish to master.

### 3.2. Progress Calculation
- **Real-time Assessment**: `useGoalProgress()` calculates the completion percentage of each goal on the fly:
  - For *Topics*, it looks up the specific `concept_id` in the `masteryList`.
  - For *Documents*, it averages the mastery score of all concepts mapped to that `document_id`.
  - For *Specific Quizzes*, it checks if the `user_attempts` list contains an attempt for the `quiz_id`.
- **Manual Completion**: Goals that reach 100% capacity fill their progress bars visually, allowing the user to click the "Complete" checkmark to permanently finalize the goal and move it to the **Completed** group.

---

## 4. Supabase API Hooks (`src/hooks/useStudyGoals.ts`)

- **CRUD Hooks**: Features `useStudyGoals`, `useCreateGoal`, `useUpdateGoal`, and `useDeleteGoal` mappings. 
- **Type Interfacing**: Integrates strongly typed payloads so the frontend correctly handles the presence or absence of specific Entity IDs (like `document_id` vs `concept_id`).

---

## 5. Verification Checklist

- [ ] Run the latest SQL Migrations in Supabase.
- [ ] Log in and navigate to the **Learning Path** page.
- [ ] Add a new goal targeted towards an Entire Document and verify the correct document selection appears.
- [ ] Interact with the specific document or complete the specific quiz and verify the progress bar fills up accurately.
- [ ] Manually click "Complete" and verify the active goal swaps to the Completed list.
