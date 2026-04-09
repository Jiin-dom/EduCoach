# Phase 4 Quiz System Test Plan

- Date: 2026-04-09
- Feature area: Quiz generation, quiz taking, attempts, results, flashcards tab entry points
- Dependency map: `educoach/docs/info/dependency-maps/phase-4-quiz-system-dependency-map.md`
- Current routes: `/quizzes`, `/quizzes/:id`

## Cross-checked scope

This plan is based on:

- `src/components/files/GenerateQuizDialog.tsx`
- `src/components/quizzes/QuizzesContent.tsx`
- `src/components/quizzes/QuizView.tsx`
- `src/components/quizzes/SelectDocumentDialog.tsx`
- `src/hooks/useQuizzes.ts`
- `src/lib/quizAllocation.ts`

## Core scenarios

### 1. Generate quiz from a document

- Open quiz generation from `/files` or `/dashboard`.
- Choose a document and generate a quiz.
- Expected:
  - validation passes for a valid request
  - quiz enters generating or ready state
  - new quiz appears in `/quizzes`

### 2. Generate quiz from quizzes page

- Open `/quizzes`.
- Use the document-selection flow to create a quiz.
- Expected:
  - shared generation flow works from this route too
  - selected document is respected

### 3. Take a ready quiz

- Open a ready quiz at `/quizzes/:id`.
- Answer all questions and submit.
- Expected:
  - attempt is created
  - score/result UI appears
  - completed quiz remains visible in the quizzes list

### 4. View quiz results

- Reopen a completed quiz.
- Expected:
  - result state is visible
  - score and answer feedback are readable
  - the same route supports completed-attempt viewing

### 5. Retry or regenerate flow

- Use any retry or regenerate option available in `QuizView`.
- Expected:
  - flow behaves consistently
  - user is not stranded between old and new quiz state

### 6. Flashcards tab from quizzes page

- Open `/quizzes?tab=flashcards`.
- Expected:
  - flashcards-related content loads
  - switching between quizzes and flashcards tabs works

## Edge cases

- generate quiz for a document with sparse concepts
- quiz remains in generating state for an extended period
- submit attempt with network interruption
- open `/quizzes/:id` for a missing or unauthorized quiz
- mixed question-type allocation request that cannot be satisfied exactly

## Validation points

- question generation and list state remain consistent across files, dashboard, and quizzes page entry points
- result viewing is integrated into the normal quiz route
- completed attempts do not erase the quiz from the list

## Pass criteria

- Quiz generation, attempt submission, and result viewing work from the current shared quiz stack.
- Edge states remain recoverable without corrupting quiz list state.
