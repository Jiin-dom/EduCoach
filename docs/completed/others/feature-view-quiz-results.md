## Feature: View Quiz Results (Completed)

This document summarizes the implementation of the feature that allows users to view and review their past quiz results from the "Completed" tab on the Quizzes page.

---

## 1. High-Level Overview

- **Goal**: Provide users with a way to review their performance on previously completed quizzes, including their answers, the correct answers, and their overall score without having to retake the quiz.
- **Architecture**:
  - **React Frontend**: 
    - Updated `QuizCard` to include a "View" button for attempted quizzes.
    - Updated `QuizView` to support a `review` mode triggered by a query parameter.
  - **Data Fetching**: Uses `useQuizAttempts` to retrieve the latest attempt data when in review mode.

---

## 2. Implementation Details

### 2.1. QuizCard Component (`src/components/dashboard/QuizCard.tsx`)
- Added a new **"View"** button using the `Eye` icon from `lucide-react`.
- The button only appears if `hasAttempt` is true (i.e., the user has a recorded score for the quiz).
- Clicking "View" navigates the user to `/quizzes/${quiz.id}?review=true`.
- Adjusted the button layout to be responsive:
  - **Desktop**: Buttons are stacked and stretched for better visibility in the card.
  - **Mobile**: Buttons are displayed side-by-side to save vertical space.

### 2.2. QuizView Component (`src/components/quizzes/QuizView.tsx`)
- **Query Parameter Handling**: Uses `useSearchParams` from `react-router-dom` to detect the `review=true` flag.
- **Review Mode Logic**:
  - Fetches all attempts for the current quiz using the `useQuizAttempts(id)` hook.
  - When `review=true` is detected, the component waits for both the quiz questions and the attempts to load.
  - It automatically selects the most recent attempt (`attempts[0]`).
  - Populates the `answers` state with the user's past answers stored in the attempt record.
  - Sets `showResults(true)` to immediately display the results/review screen.
- **Loading States**: Updated the loading condition: `quizLoading || questionsLoading || (reviewMode && attemptsLoading)`.

---

## 3. Files Modified

| File | Change |
|------|--------|
| `src/components/dashboard/QuizCard.tsx` | Added "View" button, imported `Eye` icon, and updated responsive layout. |
| `src/components/quizzes/QuizView.tsx` | Added review mode logic, `useSearchParams`, `useQuizAttempts`, and automatic results display. |

---

## 4. Verification Checklist

- [ ] Navigate to the Quizzes page (`/quizzes`).
- [ ] Select the **Completed** tab.
- [ ] Verify that each quiz shows both a **View** button and a **Retake** button.
- [ ] Click the **View** button for a previously completed quiz.
- [ ] Verify that the page loads directly to the results screen ("Quiz Completed!").
- [ ] Verify that the results correctly show:
  - Your past score.
  - "Your answer" for each question (reflecting the past attempt).
  - The correct answer for any missed questions.
  - Explanations (if available).
- [ ] Click **Retake Quiz** from the results screen and verify it starts a fresh quiz session.
- [ ] Navigate to a quiz normally (not via the View button) and verify it starts the quiz instead of showing results.

---

Fully implemented and integrated into the quiz workflow to enhance study review capabilities.
