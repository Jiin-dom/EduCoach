# Phase 3.8: Pipeline Enrichment & Study Intelligence

**Status:** Implemented  
**Date:** March 7, 2026  
**Scope:** Processing quality score, concept relationships, page-level mapping, flashcard generation, UI wiring

## Problem Statement

After phases 3 through 3.7 improved extraction quality, several features were stubbed or missing:

1. The `related_concepts` column was never populated -- no concept relationships
2. Concepts had no page/slide mapping -- students couldn't jump to source material
3. The Flashcards tab said "Coming Soon" -- SM-2 engine existed but no flashcard content
4. "Explain like I'm new" and "Quiz me on this" buttons were non-functional
5. Difficulty selection in QuizPrepTab wasn't passed to the quiz generator
6. No processing quality score -- users didn't know when to refine with Gemini

## Changes Made

### 1. Database Migration (`010_pipeline_enrichment.sql`)

- Added `processing_quality REAL` column to `documents`
- Added `source_pages INTEGER[]` column to `concepts`
- Created `flashcards` table with SM-2 fields (repetition, interval_days, ease_factor, due_date)
- RLS policies for flashcards (user sees own cards, service role bypass)

### 2. Processing Quality Score

**NLP Service (`main.py`):**
- `compute_processing_quality()` -- composite 0-1 score from 5 weighted signals:
  - cluster_coherence (0.25) -- average intra-cluster similarity
  - sentence_coverage (0.25) -- fraction of document in sentence pool
  - keyword_diversity (0.20) -- unique keyword roots / total keywords
  - concept_density (0.15) -- clusters produced vs expected for document size
  - content_length (0.15) -- penalty for very short documents
- Added `processing_quality` to `ProcessResponse`

**Edge Function (`process-document/index.ts`):**
- Stores `processing_quality` in the documents table final update

**Frontend (`StudyHeader.tsx`):**
- `ProcessingQualityBadge` component shows quality as percentage
- Color-coded: green (>=70%), amber (40-69%), red (<40%)
- Tooltip explains what the score means and suggests Gemini refinement for low scores

### 3. Concept Relationship Extraction

**NLP Service (`main.py`):**
- `extract_concept_relationships()` finds relationships between clusters via:
  - Semantic similarity between cluster centroids (threshold > 0.35)
  - Keyword co-occurrence in the same sentences
- Returns `[{source_idx, target_idx, similarity, relationship_type}]`
- Added `concept_relationships` to `ProcessResponse`

**Edge Function:**
- After inserting concepts and receiving UUIDs, maps NLP cluster indices to concept UUIDs
- Updates each concept's `related_concepts` array with bidirectional references
- Concept insert now returns IDs via `.select('id')`

### 4. Page-Level Concept Mapping

**Edge Function:**
- Slide path: `buildConceptsFromSlides()` sets `source_pages` from `slide.slide_number`
- Cluster path: `estimatePageFromPosition()` estimates page from text position (~3000 chars/page)
- `buildConceptsFromClusters()` accepts `fullText` param for page estimation

**Frontend:**
- `Concept` type in `useConcepts.ts` includes `source_pages?: number[] | null`
- `ConceptsTab.tsx` shows clickable page badges on list items and in detail dialog
- Page badges trigger `onPageJump` to sync the DocumentPane

### 5. Flashcard Generation

**NLP Service (`main.py`):**
- New endpoint `POST /generate-flashcards`
- Input: concepts with descriptions/keywords + important sentences
- Three card types per concept:
  - **Definition**: "What is X?" / description
  - **Cloze**: sentence with keyphrase blanked / keyphrase
  - **Keyword recall**: "Name key aspects of X" / keyword list
- Deduplication by front text, capped at 30 cards

**Edge Function:**
- After concept save, calls `/generate-flashcards` with concepts + sentences
- Deletes old flashcards for the document/user before inserting new ones
- Maps concept names to saved UUIDs for `concept_id` linkage
- Non-blocking: failure doesn't affect document processing

**Frontend:**
- `useFlashcards.ts` hook: `useAllFlashcards`, `useDocumentFlashcards`, `useDueFlashcards`, `useReviewFlashcard`
- SM-2 implementation in `computeSM2()` for spaced repetition scheduling
- `FlashcardsPanel` replaces "Coming Soon" in `QuizzesContent.tsx`:
  - Dashboard: total cards, due today, session reviewed
  - Study session: flip card, rate (Again/Hard/Good/Easy), auto-advance
  - All caught up state when no cards due

### 6. Wired Stubbed UI Actions

**ConceptsTab "Explain like I'm new":**
- Opens AI Tutor chat with pre-filled prompt via `onAskTutor` callback
- Sets Bloom level to "Understand"
- Message: "Explain {name} like I'm a complete beginner..."

**ConceptsTab "Quiz me on this":**
- Calls `useGenerateQuiz` with 5 questions + `enhanceWithLlm`
- Navigates to quiz on success

**QuizPrepTab difficulty:**
- `difficulty` state is now passed to `generateQuiz.mutate()` call
- Maps to the existing `difficulty` field in `GenerateQuizInput`

**AiTutorChat:**
- New `pendingPrompt` and `onPromptConsumed` props
- Auto-opens and pre-fills input when prompt arrives

## Files Modified

| File | Changes |
|------|---------|
| `supabase/migrations/010_pipeline_enrichment.sql` | New migration: flashcards table, source_pages, processing_quality |
| `nlp-service/main.py` | Quality score, relationship extraction, flashcard generation endpoint |
| `supabase/functions/process-document/index.ts` | Store quality/relationships/pages, generate flashcards |
| `src/hooks/useDocuments.ts` | Added `processing_quality` to Document interface |
| `src/hooks/useConcepts.ts` | Added `source_pages` to Concept interface |
| `src/hooks/useFlashcards.ts` | New hook: flashcard CRUD + SM-2 review |
| `src/components/files/StudyHeader.tsx` | ProcessingQualityBadge component |
| `src/components/files/ConceptsTab.tsx` | Page badges, wired Explain/Quiz buttons |
| `src/components/files/QuizPrepTab.tsx` | Difficulty passthrough to generator |
| `src/components/files/FileViewer.tsx` | tutorPrompt state, pass callbacks |
| `src/components/shared/AiTutorChat.tsx` | pendingPrompt auto-open/pre-fill |
| `src/components/quizzes/QuizzesContent.tsx` | FlashcardsPanel replacing "Coming Soon" |

## Deployment

1. Apply migration: `010_pipeline_enrichment.sql`
2. Rebuild NLP service: `docker compose build nlp-service && docker compose up -d`
3. Deploy Edge Function: `npx supabase functions deploy process-document --no-verify-jwt`
4. Rebuild frontend (automatic with new TS files)
5. Re-process existing documents to generate quality scores, relationships, and flashcards
