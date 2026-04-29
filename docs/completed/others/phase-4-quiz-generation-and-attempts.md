## Phase 4 – Quiz Generation & Attempts (Completed)

This document summarizes what was actually implemented for Phase 4: quiz generation and attempts, based on the original plan in `Logs/implementation.md` and the final code in `educoach/`.

---

## 1. High-Level Overview

- **Goal**: Turn processed documents (Phase 3 output) into auto-generated quizzes and track student attempts.
- **Architecture**:
  - **NLP Service (Python FastAPI)**: Primary, template-driven question generator (`/generate-questions`).
  - **Supabase Edge Function (`generate-quiz`)**: Orchestrator between the database, NLP service, and (optionally) Gemini.
  - **Supabase Postgres**: New tables for `quizzes`, `quiz_questions`, and `attempts` with RLS.
  - **React Frontend**: Hooks and UI for generating quizzes, taking them, and recording attempts.

Compared to the original plan (Gemini-first), the final design makes the **NLP service the main AQG engine** and uses **Gemini only as an optional enhancement layer** (phrasing, distractors, explanations).

---

## 2. Database Schema (Migration `005_quiz_tables.sql`)

A new migration file `supabase/migrations/005_quiz_tables.sql` was added to define the quiz-related tables and RLS policies.

- **`quizzes` table**
  - Links a quiz to:
    - `user_id` (owner)
    - `document_id` (source document)
  - Stores:
    - `title`, `description`
    - `question_count`
    - `difficulty`
    - `time_limit_minutes`
    - `status` (`generating`, `ready`, `error`)
    - `error_message` (for failures)
    - timestamps (`created_at`, `updated_at`)
  - Indexed by `user_id`, `document_id`, and status for efficient querying.
  - **RLS**: Users can only see and manage their own quizzes.

- **`quiz_questions` table**
  - Links a question to:
    - `quiz_id`
    - optional `concept_id` and `source_chunk_id` (traceability back to document/concepts).
  - Stores:
    - `question_type` (`multiple_choice`, `true_false`, `identification`, `fill_in_blank`)
    - `question_text`
    - `options` (JSONB array, when applicable)
    - `correct_answer`
    - `explanation`
    - `difficulty_level`
    - `order_index`
    - `created_at`
  - **RLS**: Accessible only via the parent `quiz`’s `user_id`.

- **`attempts` table**
  - Links an attempt to:
    - `user_id` (student)
    - `quiz_id`
  - Stores:
    - `score`
    - `total_questions`
    - `correct_answers`
    - `answers` (JSONB payload of per-question responses)
    - `time_taken_seconds`
    - `started_at`, `completed_at`, `created_at`
  - **RLS**: Users can only see their own attempts.

---

## 3. NLP Service – `/generate-questions` Endpoint

The Python NLP microservice in `nlp-service/main.py` was extended with a new endpoint:

- **Endpoint**: `POST /generate-questions`
- **Input model**: `GenerateQuestionsInput`
  - Includes:
    - Raw/processed text
    - Concepts/keyphrases
    - Important sentences
    - Target counts per question type
    - Difficulty settings
- **Output model**: `GenerateQuestionsResponse`
  - Returns a list of template-generated questions with:
    - `question_type`
    - `question_text`
    - `options` (if applicable)
    - `correct_answer`
    - `explanation`
    - `difficulty_level`

### 3.1. Template-Driven AQG Logic

The endpoint uses the Phase 3 NLP outputs plus spaCy, TextRank, and KeyBERT (as described in `Logs/Obj3.md`) to generate questions:

- **Identification Questions**
  - Use named entities, keyphrases, and noun chunks to ask for a short concept/topic name.
  - Store a short canonical term/phrase as the correct answer, not a sentence or paragraph definition.
  - Template examples:
    - “What is **X**?”
    - “What term is being described?”

- **True/False Questions**
  - Derived from important sentences.
  - Some sentences are used as-is (True).
  - Others are minimally perturbed (swapping entities or values) to create False statements.

- **Multiple Choice Questions**
  - Centered on key concepts or definitions.
  - **Distractors**:
    - Pulled from other, similar keyphrases/concepts.
    - Validated to avoid duplicates and obviously-wrong noise.

- **Fill-in-the-Blank Questions**
  - Take important sentences and mask a key term.
  - Example:
    - Source: “The operating system manages **hardware resources**.”
    - Question: “The operating system manages **_____**.”

### 3.2. Validation & Filtering

The generator performs basic validation:

- De-duplicates near-identical questions.
- Ensures each question has:
  - Non-empty text,
  - A clear answer,
  - Enough options (for MCQ).
- Tries to balance across requested question types and difficulty levels.

---

## 4. Supabase Edge Function – `generate-quiz`

A new Edge Function was added at `supabase/functions/generate-quiz/index.ts`.

### 4.1. Responsibilities

- Validate the incoming request:
  - Authenticated user.
  - Valid `document_id` (and optionally, concept filters).
- Fetch source data from the database:
  - Document metadata.
  - Processed text/chunks.
  - Extracted concepts from Phase 3.
- Create a `quizzes` row with:
  - Initial status `generating`.
- Call the **NLP service** `/generate-questions` endpoint:
  - Build the payload from document text, keyphrases, and concepts.
  - Pass requested counts per question type and difficulty.
- Optionally call **Gemini** (if configured):
  - Refine phrasing.
  - Improve distractors.
  - Add or polish explanations.
- Insert generated questions into `quiz_questions`.
- Update the `quizzes` row:
  - `status` → `ready` on success.
  - `status` → `error` + `error_message` on failure.

### 4.2. Error Handling & Fallbacks

- If the NLP service is unavailable:
  - The function records an error state on the quiz.
  - The UI surfaces “generating failed” / “try again” states.
- Network and RPC calls are wrapped with try/catch and timeouts similar to existing Edge Functions.

---

## 5. React Query Hooks – `useQuizzes.ts`

A new hook module `src/hooks/useQuizzes.ts` was created to centralize quiz-related data access.

### 5.1. Types

- **`Quiz`**
  - Mirrors the `quizzes` table (id, user_id, document_id, title, description, question_count, difficulty, time_limit_minutes, status, error_message, timestamps).
- **`QuizQuestion`**
  - Mirrors the `quiz_questions` table (id, quiz_id, question_type, question_text, options, correct_answer, explanation, difficulty_level, order_index, created_at).
- **`Attempt`**
  - Mirrors the `attempts` table.
- **Mutation input types**
  - `GenerateQuizInput`
  - `SubmitAttemptInput`

### 5.2. Hooks

- **Queries**
  - `useQuizzes` – fetch all quizzes for the current user (with filters like status).
  - `useQuiz` – fetch a single quiz by id.
  - `useQuizQuestions` – fetch questions for a quiz.
  - `useUserAttempts` – fetch attempts for the current user (optionally by quiz).

- **Mutations**
  - `useGenerateQuiz` – call the `generate-quiz` Edge Function to create a new quiz from a document (or from the dashboard/file viewer).
  - `useSubmitAttempt` – submit a finished attempt and store score/answers.
  - `useDeleteQuiz` – delete a quiz (where allowed).

All hooks use **React Query** with the existing Supabase client, cache keys, and error handling pattern established in earlier phases.

---

## 6. Frontend UI – Quiz Generation & Taking

### 6.1. Generate Quiz Entry Points

- **`FileViewer.tsx`**
  - Added a **“Generate Quiz”** action for a specific document.
  - Uses `useGenerateQuiz`:
    - Sends the `document_id` (and optionally filtered concepts).
    - Shows loading state while the Edge Function runs.
    - On success, navigates directly to the newly created quiz session page.

- **`FilesContent.tsx`**
  - Each document row now has a **sparkle / Generate Quiz** button.
  - Uses the same `useGenerateQuiz` mutation to create a quiz for that document.

- **`DashboardContent.tsx`**
  - Updated to:
    - Use real quiz data (`useQuizzes`, `useUserAttempts`).
    - Render `QuizCard` with `quiz` objects and `lastScore`.
    - Wire a dashboard-level **Generate Quiz** button to `useGenerateQuiz`.

### 6.2. Quiz Listing

- **`QuizzesPage.tsx` + `QuizzesContent.tsx`**
  - Switched from mock data to real data fetched via `useQuizzes` and `useUserAttempts`.
  - Show:
    - Available quizzes.
    - Completed quizzes (with latest score).
    - Loading, error, and empty states based on React Query.

### 6.3. Quiz Taking UI

- **`QuizView.tsx`**
  - Swapped out old mock `sampleQuizzes` with:
    - `useQuiz` (quiz metadata).
    - `useQuizQuestions` (list of questions).
  - Supports **all four question types**:
    - Multiple Choice
    - True/False
    - Identification (short text input)
    - Fill-in-the-Blank
  - Handles:
    - Per-question answer state in local React state.
    - Validation before submit (e.g., cannot submit while still loading).
    - Calls `useSubmitAttempt` to persist results.
  - After submission:
    - Displays score and result summary.
    - Shows a **“Back to Document”** link so the student can return to the source material.

### 6.4. Quiz Cards & Statuses

- **`QuizCard.tsx`**
  - Refactored to take a full `Quiz` object plus optional `lastScore`.
  - Derives:
    - Title, difficulty, question count.
    - Estimated duration:
      - Use `quiz.time_limit_minutes` if set.
      - Otherwise estimate from `question_count`.
  - Visual states:
    - `generating` – quiz is still being created.
    - `ready` – quiz is available to take.
    - `error` – quiz generation failed (with message).

---

## 7. Routing & Navigation

- **`App.tsx`**
  - Routes already present for:
    - `QuizzesPage` – quiz overview.
    - `QuizSessionPage` – single quiz session.
  - Phase 4 ensured these pages are wired to **real data** instead of mock content.

---

## 8. How to Deploy Phase 4 Changes

To fully use Phase 4 in a real environment:

1. **Apply the database migration**
   - In Supabase SQL Editor, run:
   - `supabase/migrations/005_quiz_tables.sql`
2. **Deploy the Edge Function**
   - From the `educoach` project root:
   - `npx supabase functions deploy generate-quiz --project-ref <your_project_ref> --no-verify-jwt`
3. **Update & Redeploy the NLP Service**
   - Rebuild the Docker image for `nlp-service` with the new `/generate-questions` endpoint.
   - Redeploy it to your hosting environment.
4. **Rebuild the Frontend**
   - Rebuild and redeploy the React app so the new hooks and UI are available.

---

## 9. Verification Checklist

- **From Files**
  - Upload or select an existing processed document.
  - Click **Generate Quiz** from:
    - `FileViewer` quick actions, or
    - `FilesContent` list row.
  - Confirm:
    - A new quiz appears in `Quizzes` and `Dashboard`.
    - Quiz status transitions from `generating` → `ready` (or `error` on failure).

- **Taking a Quiz**
  - Open the quiz from:
    - `Quizzes` page, or
    - `Dashboard` recent quizzes.
  - Answer:
    - MCQ, T/F, Identification, Fill-in-the-Blank questions.
  - Submit and verify:
    - Score is computed.
    - Attempt appears in the database and `attempts` views.

- **Error Paths**
  - Temporarily break the NLP service (or simulate failure).
  - Confirm:
    - Quiz status shows `error`.
    - UI surfaces a helpful message and/or retry options.

With these pieces in place, **Phase 4 – Quiz Generation & Attempts is fully implemented and integrated** with the existing document processing pipeline.

