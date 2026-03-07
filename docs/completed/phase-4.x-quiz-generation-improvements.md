# Phase 4.x: Quiz Generation Quality Upgrade

**Status:** Implemented  
**Date:** March 7, 2026  
**Scope:** Data flow fixes, question quality improvements, UX enhancements, slide-aware generation

## Problem Statement

After Phase 3.x enriched the document processing pipeline with semantic clustering, slide-aware extraction, concept relationships, quality scores, and flashcards, the quiz generation system (Phase 4) was still running with its original basic implementation. Specific issues:

1. **Broken data flow**: All concepts' keyphrases were sent to every chunk (no per-chunk filtering), `important_sentences` were always empty, `concepts.chunk_id` was never set, and the user's difficulty choice had zero effect
2. **Low question quality**: Only 3 identification templates, fragile True/False negation, length-based distractor selection, no explanations from NLP service, hardcoded difficulty labels
3. **Poor UX**: No polling for generating status, no retry on failure, no error feedback, fixed 10-question count, no time tracking, naive answer grading
4. **Wasted pipeline data**: Slide structure, concept relationships, and quality signals from Phase 3.6-3.8 were completely ignored during quiz generation

## User Workflow: Quiz Generation and Taking

End-to-end flow from the student’s perspective.

### 1. Prerequisite: Document is processed

- User uploads a document (PDF, DOCX, PPTX, etc.) and the document is **processed** (status becomes **Ready**).
- Processing extracts text, concepts, and (for slides) page/slide structure. Without this, quiz generation is not available.

### 2. Starting quiz generation

User can start a quiz from:

- **File detail (Quiz Prep tab)**  
  - Open a document → **Quiz Prep** tab.  
  - Optionally: review “What you should know” concepts, select **Difficulty** (Mixed / Easy / Medium / Hard), and choose **Number of questions** (5, 10, 15, or 20).  
  - Click **Generate {N}-Question Quiz**.  
- **Files list**  
  - Click the **Generate Quiz** (sparkle) action on a document row.  
- **Dashboard**  
  - Use the dashboard **Generate Quiz** entry point (if wired); typically uses default count and difficulty.

### 3. While the quiz is generating

- User is taken to the quiz session URL (`/quizzes/:id`).
- Screen shows: **“Generating Quiz…”** with a spinner and the message **“This page will update automatically when ready.”**
- The app **polls every 4 seconds**; when the quiz status changes from `generating` to `ready`, the page refreshes and the quiz appears — no manual refresh needed.

### 4. Taking the quiz

- **Header**: Quiz title, “Question X of N”, and question-type badge.
- **Progress bar** for position in the quiz.
- **Question card**: One question at a time (Multiple Choice, True/False, Identification, or Fill in the Blank).
- **Navigation**: **Previous** / **Next**; on the last question, **Submit Quiz** becomes available once every question has an answer.
- **Status card**: “Questions Answered X / N” and **Time Elapsed** (M:SS). Time is sent with the attempt when the user submits.

### 5. Submitting and seeing results

- User clicks **Submit Quiz**.  
- **Score** (percentage) and “X out of N correct” are shown.  
- **Review**: Each question is listed with correct/incorrect, the user’s answer, the correct answer (if wrong), and any **explanation** when available.  
- **Actions**: **Back to Quizzes**, **Retake Quiz** (same quiz, timer resets), and **View Source Document** (link to the file).

### 6. If generation fails

- Quiz session page shows **“Quiz Generation Failed”** and the error message.  
- User can click **Retry** (creates a new quiz from the same document) or **Back to Quizzes**.  
- From **Quiz Prep**, if generation fails, an **inline error card** appears above the generate button so the user can adjust (e.g. try again or pick a different document).

### Summary flow

```
Upload document → Process (Ready) → Quiz Prep (or list/dashboard)
  → Choose difficulty + question count → Generate Quiz
  → Auto-redirect to /quizzes/:id → “Generating…” (auto-refresh when ready)
  → Answer questions → Submit → See score + review → Retake or Back to document
```

## Changes Made

### Phase 4.1: Data Flow Fixes

**process-document/index.ts:**
- Added `chunk_id?: string` to the `Concept` interface
- New `mapConceptsToChunks()` function that maps each concept to its best-matching chunk by checking if the chunk contains the concept's description, name, or keywords
- Concept records now include `chunk_id` when saving to the database, enabling proper concept-question traceability

**generate-quiz/index.ts:**
- **Per-chunk keyphrases**: For each chunk, only concepts whose name or keywords appear in the chunk content are used, instead of dumping all concepts into every chunk. Falls back to top 5 concepts if no direct matches found.
- **Important sentences per chunk**: Extracts sentences from each chunk that contain at least one keyphrase, providing the NLP service with higher-quality sentence candidates
- **Difficulty passthrough**: Added `DIFFICULTY_MAP` that translates `easy/medium/hard/mixed` to `beginner/intermediate/advanced/mixed` and passes it to both the NLP service and Gemini
- **Concept info array**: Passes concept names, importance, difficulty, keywords, descriptions, and source_pages to the NLP service for concept coverage balancing
- **Slide detection**: Detects slide-based documents by checking if concepts have `source_pages`, and passes `document_type: 'slides'` to the NLP service
- **Gemini prompt improvement**: Added difficulty instruction and concept coverage directive to the Gemini fallback prompt

### Phase 4.2: Question Quality (NLP Service)

**nlp-service/main.py — `/generate-questions` endpoint:**

- **Expanded input model**: `GenerateQuestionsInput` now accepts `difficulty`, `concepts` (with name, importance, difficulty_level, keywords, description, source_pages), and `document_type`
- **Expanded output**: `GeneratedQuestion` now includes an `explanation` field

**Identification templates** — expanded from 3 to 10+ templates across difficulty levels:
- Beginner: "What is X?", "Define X.", "What does X refer to?"
- Intermediate: "Explain X in detail.", "What is the purpose of X?", "How does X work?", "Describe the role of X."
- Advanced: "What are the key characteristics of X?", "Compare and contrast X with related concepts.", "Analyze how X relates to the broader topic."

**True/False generation** — two-strategy approach:
1. Entity/keyphrase swapping (primary): finds a named entity or keyphrase in the sentence and swaps it with a different one from the same type/pool, creating a more natural false statement
2. Verb negation (fallback): inserts "not" after the main verb, same as before but only used when swapping fails

**Semantic distractor selection** — uses `sentence-transformers` (already loaded as `st_model`):
- Encodes the correct answer and all candidate distractors
- Ranks by cosine similarity (0.15-0.85 range — similar enough to be plausible, different enough to be wrong)
- Falls back to length-based sorting if embedding fails

**Explanations for every question** — `_build_explanation()` generates a source-grounded explanation for each question type using the supporting sentence

**Difficulty-aware type weighting** — `_DIFFICULTY_TYPE_WEIGHTS` biases question type selection:
- Beginner: more T/F and identification
- Advanced: more MCQ and fill-in-blank
- Mixed: balanced distribution

**Concept coverage balancing** — `_balance_by_concept_coverage()`:
- Maps questions to concepts by checking if the concept name appears in the question text
- Round-robin selects one question per concept before allowing duplicates
- Ensures major concepts aren't missed even when chunk-level generation clusters around early content

**Question quality validation** — `_validate_question()` rejects:
- Questions with text shorter than 15 characters
- Answers shorter than 2 characters
- MCQs with fewer than 3 options or non-unique options
- Fill-in-blank without the blank marker

**Keyphrase diversity** — tracks used keyphrases across chunks and prefers unused ones for each new question

### Phase 4.3: Frontend UX

**useQuizzes.ts:**
- `useQuiz` now auto-polls every 4 seconds when `quiz.status === 'generating'` (same pattern as Phase 3.9's document processing poll). Stops automatically when status changes.

**QuizView.tsx:**
- **Polling indicator**: "This page will update automatically when ready" message with pulse animation during generating state
- **Retry button**: When quiz generation fails, shows a "Retry" button alongside "Back to Quizzes" that creates a new quiz from the same document
- **Time tracking**: Starts a timer when the quiz loads, displays elapsed time as `M:SS` in the status card, sends `timeTakenSeconds` with the attempt submission
- **Improved answer grading** (`isAnswerCorrect`):
  - T/F and MCQ: exact match (unchanged)
  - Fill-in-blank: Levenshtein distance with 20% tolerance (e.g., "convolutional" accepts "convolution")
  - Identification: Levenshtein with 80% similarity threshold, plus normalized substring matching with 60% length requirement. Strips articles, punctuation, and extra whitespace before comparison.

**QuizPrepTab.tsx:**
- **Question count selector**: 4 buttons (5, 10, 15, 20) replacing the hardcoded 10-question limit
- **Error display**: Inline error card with amber styling when generation fails
- **Dynamic button text**: Shows "Generate {N}-Question Quiz" based on selected count

### Phase 4.4: Slide-Aware Quiz Generation

**nlp-service/main.py:**
- New `_generate_slide_questions()` function that creates questions directly from concept metadata (name + description) rather than chunk text
- Slide identification templates: "What is covered in the section on {name}?", "Summarize the key points about {name}."
- Slide MCQ: uses concept names as distractors — "Which of the following best describes {name}?" with other concept names as wrong options
- Slide fill-in-blank: blanks the concept name in its own description
- Supplements chunk-based questions when `document_type === 'slides'`

**generate-quiz/index.ts:**
- Passes `document_type: 'slides'` when concepts have `source_pages`
- Passes concept `description` and `source_pages` to the NLP service

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/process-document/index.ts` | `chunk_id` in Concept interface, `mapConceptsToChunks()`, concept records include chunk_id |
| `supabase/functions/generate-quiz/index.ts` | Per-chunk keyphrases, important sentences, difficulty passthrough, concept info, slide detection, Gemini difficulty prompt |
| `nlp-service/main.py` | Expanded templates, entity swap T/F, semantic distractors, explanations, difficulty weighting, concept coverage, quality validation, slide questions |
| `src/hooks/useQuizzes.ts` | Auto-polling for generating status |
| `src/components/quizzes/QuizView.tsx` | Polling indicator, retry button, time tracking, Levenshtein grading |
| `src/components/files/QuizPrepTab.tsx` | Question count selector, error display |

## Deployment

1. Rebuild NLP service: `docker compose build nlp-service && docker compose up -d`
2. Deploy generate-quiz Edge Function: `npx supabase functions deploy generate-quiz --no-verify-jwt`
3. Deploy process-document Edge Function: `npx supabase functions deploy process-document --no-verify-jwt`
4. Frontend rebuilds automatically (Vite HMR or `npm run build`)
5. Re-process existing documents to populate `concepts.chunk_id` (existing documents won't have this until reprocessed)

## Backward Compatibility

- No database migration required — `chunk_id` already exists on the concepts table
- All new NLP input fields (`difficulty`, `concepts`, `document_type`) have defaults and are optional
- The `explanation` field on generated questions is optional (existing code already checks `q.explanation` before rendering)
- Question count selector defaults to 10 (same as before)
- Grading changes are backward-compatible (only makes matching more lenient, not stricter)

---

## Phase 4.5: True/False & Sentence Quality Fix

**Status:** Implemented
**Date:** March 7, 2026
**Scope:** Fix True/False questions using interrogative/rhetorical sentences as statements

### Problem

True/False questions were being generated from interrogative sentences (e.g. "How do you transform that grid of numbers into understanding... or even something useful?" shown with True/False options). This happens because no filter checks whether a sentence is a declarative statement before using it as T/F material. Questions ending with "?" and sentences containing ellipsis ("...") are common in slide-based documents and should never be presented as True/False.

### Root Causes

1. `_generate_true_false()` accepted any sentence without checking if it's a question vs statement
2. `is_good_sentence()` filtered for length, URLs, slide markers, and letter ratio, but never filtered interrogative sentences or rhetorical content
3. `_validate_question()` checked length and option counts but had no type-specific validation for True/False
4. The Gemini enhancement prompt said "Do NOT change the question_type", preventing it from fixing mistyped questions
5. No filter for ellipsis patterns common in slide presentations

### Changes Made

**nlp-service/main.py:**

- **New `_is_declarative_statement()` helper**: Rejects sentences that:
  - End with "?"
  - Start with interrogative words (How, What, Why, When, Where, Who, Which, Can, Could, Should, Would, Is, Are, Do, Does, Did, Will, Has, Have, Shall, May, Might)
  - Contain ellipsis ("..." or unicode ellipsis)
  - Start with an imperative verb (detected via spaCy POS tagging)
- **`_generate_true_false()` gated**: Added `_is_declarative_statement()` check at the top, before the existing ambiguous qualifier filter
- **`is_good_sentence()` strengthened**: Added rejection of sentences ending with "?" and sentences containing ellipsis, filtering them out of the sentence pool entirely
- **`_validate_question()` improved**: Added True/False-specific validation that rejects questions ending with "?", starting with interrogative words, or containing ellipsis
- **Generation loop pre-filter**: In the `/generate-questions` endpoint, when the selected question type is `true_false`, non-declarative sentences are skipped before calling the generator

**generate-quiz/index.ts:**

- **Gemini enhancement prompt updated**: Removed "Do NOT change the question_type" restriction. Added rules requiring True/False questions to be declarative statements and allowing Gemini to rephrase interrogative T/F questions into statements or change their type to identification
- **Gemini fallback prompt updated**: Added explicit rule that True/False `question_text` must be a declarative statement
- **Post-enhancement validation**: After Gemini enhancement returns, a filter removes any True/False questions that still end with "?", start with interrogative words, or contain ellipsis. Logs the count of removed questions.

### Defense in Depth

The fix applies at five layers to ensure no interrogative T/F questions reach the user:

1. **Sentence pool** (`is_good_sentence`) — questions and rhetorical sentences are excluded from the pool
2. **Generation loop** — non-declarative sentences are skipped for T/F generation
3. **Generator function** (`_generate_true_false`) — declarative check at function entry
4. **Validation** (`_validate_question`) — T/F type-specific quality gate
5. **Edge function post-filter** — catches any that slip through NLP or Gemini enhancement

### Files Modified

| File | Changes |
|------|---------|
| `nlp-service/main.py` | `_is_declarative_statement()`, `_INTERROGATIVE_STARTS`, `_ELLIPSIS_RE`, gated T/F generator, strengthened `is_good_sentence()`, T/F validation in `_validate_question()`, loop pre-filter |
| `supabase/functions/generate-quiz/index.ts` | Updated enhancement prompt, updated fallback prompt, post-enhancement T/F filter |

### Deployment

1. Rebuild NLP service: `docker compose build nlp-service && docker compose up -d`
2. Deploy generate-quiz Edge Function: `npx supabase functions deploy generate-quiz --no-verify-jwt`
3. No database migration required
4. No frontend changes required
