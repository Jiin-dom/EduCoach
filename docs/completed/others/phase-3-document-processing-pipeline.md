## Phase 3 -- Document Processing Pipeline (Completed)

This document summarizes what was implemented for Phase 3: the NLP microservice for text extraction, the Supabase Edge Function for document processing, concept extraction (Pure NLP default with Gemini fallback), vector embeddings for RAG, and the frontend file viewer with concepts display.

---

## 1. High-Level Overview

- **Goal**: Process uploaded documents to extract text, generate concepts, and create vector embeddings for downstream features (quiz generation, AI tutor chat).
- **Architecture**:
  - **NLP Service (Python FastAPI)**: Apache Tika for text extraction, TextRank for sentence ranking, KeyBERT for keyword extraction. Runs as a Docker container.
  - **Supabase Edge Function (`process-document`)**: Orchestrator that downloads the file, calls the NLP service, runs Pure NLP or Gemini concept extraction, generates embeddings, and saves everything to the database.
  - **Supabase Postgres**: New tables for `chunks`, `concepts`, `document_embeddings` with pgvector extension.
  - **React Frontend**: `useConcepts` hook for concept data access, `FileViewer` component for displaying extracted concepts and document summary.

The final design uses **Pure NLP as the default processor** (no API key needed) and falls back to **Gemini only when Pure NLP produces limited results** (or when explicitly overridden by the user).

---

## 2. Database Schema (Migrations `002`, `003`, `004`)

### Migration `002_document_processing.sql`

Enables pgvector and creates 3 new tables:

#### `chunks` Table

Stores text segments extracted from documents.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `document_id` | UUID FK | → documents, ON DELETE CASCADE |
| `content` | TEXT | NOT NULL, chunk text |
| `chunk_index` | INTEGER | NOT NULL, 0-based position in document |
| `start_page` | INTEGER | Nullable, for PDFs |
| `end_page` | INTEGER | Nullable, for PDFs |
| `token_count` | INTEGER | Approximate token count |
| `created_at` | TIMESTAMPTZ | |

Indexed by `(document_id)` and `(document_id, chunk_index)`.
**RLS**: Users can view chunks from their own documents. Service role has full access.

#### `concepts` Table

Stores key concepts extracted from documents for quiz generation and analytics.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `document_id` | UUID FK | → documents, ON DELETE CASCADE |
| `chunk_id` | UUID FK | → chunks, ON DELETE SET NULL, nullable |
| `name` | TEXT | NOT NULL, short concept name |
| `description` | TEXT | Detailed explanation |
| `category` | TEXT | Topic classification |
| `importance` | INTEGER | 1-10 scale, CHECK constraint |
| `related_concepts` | UUID[] | Self-referencing for concept maps |
| `difficulty_level` | TEXT | beginner / intermediate / advanced |
| `keywords` | TEXT[] | Related terms for studying |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Trigger-maintained |

Indexed by `document_id`, `category`, `importance DESC`.
**RLS**: Users can view concepts from their own documents. Service role has full access.

#### `document_embeddings` Table

Stores vector embeddings for semantic search (RAG).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `document_id` | UUID FK | → documents, ON DELETE CASCADE |
| `chunk_id` | UUID FK | → chunks, ON DELETE CASCADE |
| `embedding` | vector(768) | Gemini `gemini-embedding-001` at 768 dimensions |
| `content_preview` | TEXT | First ~100 chars for quick reference |
| `created_at` | TIMESTAMPTZ | |

Indexed by `document_id` and via HNSW index (`vector_cosine_ops`) for fast similarity search.
**RLS**: Users can view embeddings from their own documents. Service role has full access.

#### `match_documents()` Function

A PL/pgSQL function for semantic similarity search:
- Input: `query_embedding` (vector 768), `match_threshold` (default 0.7), `match_count` (default 5), optional `filter_document_id`.
- Returns: id, document_id, chunk_id, content_preview, similarity score.
- Uses cosine distance operator (`<=>`) for similarity.
- Used by the Phase 6 AI Tutor for RAG retrieval.

### Migration `003_add_original_text.sql`

Adds `original_text TEXT` column to the `documents` table. Stores the full extracted text for:
- Faster re-processing (no need to re-extract from the file).
- Full-text search capabilities.
- RAG context.

### Migration `004_add_processed_by.sql`

Adds `processed_by TEXT` column to the `documents` table. Tracks which processor was used (`pure_nlp` or `gemini`) for transparency.

---

## 3. NLP Microservice (`nlp-service/`)

A Python FastAPI service that runs as a Docker container, providing text extraction and NLP analysis.

### 3.1. Dependencies

| Package | Purpose |
|---------|---------|
| FastAPI + Uvicorn | HTTP server |
| spaCy (`en_core_web_sm`) | NLP pipeline, sentence splitting |
| pytextrank | TextRank sentence ranking (spaCy pipe) |
| keybert | BERT-based keyword extraction |
| requests | HTTP calls to Apache Tika |

### 3.2. Endpoints

#### `GET /health`

Health check for Docker container monitoring.

#### `POST /extract` — Text Extraction

Extracts plain text from a document file using Apache Tika.
- Input: File upload (PDF, DOCX, PPTX, TXT, etc.).
- Output: `{ success, text, char_count, error }`.
- Sends the file to Tika's `/tika` endpoint with `Accept: text/plain`.
- Applies text cleaning: removes URLs, slide/page markers, mojibake artifacts, collapses whitespace.

#### `POST /rank-sentences` — TextRank Sentence Ranking

Ranks sentences by importance using the TextRank algorithm (via pytextrank).
- Input: `{ text, top_n }`.
- Output: `{ success, sentences: [{ text, rank }], error }`.
- Filters out noise sentences (too short, too many special characters, URL-heavy).

#### `POST /extract-keywords` — KeyBERT Keyword Extraction

Extracts key phrases using BERT-based semantic similarity.
- Input: `{ text, top_n }`.
- Output: `{ success, keywords: [{ keyword, score }], error }`.
- Configuration: n-gram range 1-3, max_sum diversity for varied results.
- Filters out noisy keywords (URLs, page markers, too short).

#### `POST /process` — Full Processing Pipeline

**Main endpoint called by the Edge Function.** Runs the complete pipeline:
1. Extract text with Tika.
2. Clean the extracted text.
3. Rank sentences with TextRank (top 15).
4. Extract keywords with KeyBERT (top 20).
5. Return: `{ success, text, keywords, important_sentences, char_count, error }`.

Uses a process lock (`PROCESS_LOCK`) to serialize processing (prevents Tika overload).

### 3.3. Text Cleaning (`clean_extracted_text`)

- Removes URLs (`http://`, `www.`).
- Removes slide/page number markers.
- Fixes common PDF mojibake artifacts (`â€™` → `'`, `â€œ` → `"`, etc.).
- Collapses excessive whitespace while preserving sentence boundaries.
- Removes noisy header/footer lines (page numbers, separator patterns).

### 3.4. Docker Setup

`Dockerfile` builds the service with:
- Python base image with Java (required for Tika).
- spaCy model download (`en_core_web_sm`).
- Tika server running as a background process.
- Uvicorn serving FastAPI on configurable port.

---

## 4. Supabase Edge Function — `process-document`

Located at `supabase/functions/process-document/index.ts`. The main orchestrator for document processing.

### 4.1. Processing Pipeline (10 steps)

1. **Parse request** — Extract `documentId` and optional `processor` override.
2. **Resolve processor** — Determine Pure NLP vs Gemini based on: request override → env `DEFAULT_PROCESSOR` → env `USE_PURE_NLP` → default `pure_nlp`.
3. **Fetch document metadata** from the database.
4. **Update status** to `processing`.
5. **Download file** from Supabase Storage.
6. **Extract text** — If NLP service URL is configured, call `/process` endpoint. Otherwise, fallback to basic text extraction (raw `blob.text()` for text files, basic regex cleanup for PDFs).
7. **Save original text** to the `documents.original_text` column.
8. **Chunk the text** — Split into segments of ~2800 chars with 200 char overlap, breaking at sentence boundaries. Max 20 chunks.
9. **Clear previous derived data** — Delete old chunks, concepts, embeddings for this document.
10. **Save chunks** to the `chunks` table.

### 4.2. Concept Extraction

Two paths for concept extraction:

#### Pure NLP Path (Default)

The `buildPureNlpResult()` function processes concepts without any API calls:

1. **Clean text** — Strip URLs, slide markers, mojibake.
2. **Build sentence pool** — Use NLP-service-ranked sentences (or fallback to basic splitting). Filter for study-friendly sentences (40-400 chars, >45% letters, no URLs). Dedup by normalized content. Cap at 20.
3. **Generate summary** — First 3 sentences from the pool (or first 300 chars).
4. **Filter keywords** — Clean NLP keywords (or frequency-based fallback). Remove URLs, slide markers, too-short terms.
5. **Build concepts** — For each keyword:
   - Find the best supporting sentence (contains the keyword).
   - Derive concept name via `toTitleCase()` (with acronym handling: RNN, LSTM, CNN, etc.).
   - Derive keywords from the supporting sentence.
   - Assign importance based on sentence rank position.
6. **Fallback** — If keyword-based concepts < 5, fall back to sentence-based concepts using `deriveConceptName()`.
7. **Dedup** — Merge duplicate concept names, keeping the higher-importance version.
8. **Auto-fallback to Gemini** — If Pure NLP produces 0 concepts or empty summary AND Gemini is available AND no explicit processor override, automatically fall back to Gemini.

#### Gemini Path (Optional)

For single documents: `processSingleDocument()` sends the full text to Gemini with a structured prompt requesting summary + concepts in JSON format.

For multi-chunk documents: `processChunkedDocument()`:
1. Process each chunk separately via `processChunk()`.
2. Combine results via `combineChunkResults()` — sends all chunk summaries, key points, and concepts to Gemini for synthesis into a unified analysis.

Both use `callGemini()` with retry logic (3 attempts, exponential backoff), model `gemini-2.5-flash-lite`, temperature 0.3, `responseMimeType: application/json`.

### 4.3. Embedding Generation

After concept extraction, if a Gemini API key is available:

1. Process chunks in batches of 3.
2. For each chunk, call `generateEmbedding()` — uses `gemini-embedding-001` with `outputDimensionality: 768`.
3. Save embeddings to `document_embeddings` table with `content_preview` (first 100 chars).
4. Rate limiting: 1.5 second delay between batches (respects free-tier limits).
5. Non-blocking: embedding failures are logged but don't fail the overall processing.

### 4.4. Final Update

Updates the `documents` row with:
- `status` → `ready`
- `summary` — extracted/generated summary
- `concept_count` — number of concepts extracted
- `processed_by` — `pure_nlp` or `gemini` (if column exists)

### 4.5. Error Handling

- User-friendly error messages with `ERROR_CODE:message` format.
- Specific codes: `INVALID_REQUEST`, `DOC_NOT_FOUND`, `STORAGE_ERROR`, `EMPTY_DOC`, `NLP_SERVICE_ERROR`, `NLP_SERVICE_TIMEOUT`, `CONFIG_ERROR`, `AI_BUSY`, `AI_RATE_LIMIT`, `AI_INVALID`, `AI_AUTH`, `AI_SAFETY`, `AI_EMPTY`, `AI_NETWORK`, `AI_ERROR`, `DB_ERROR`.
- On any error: updates document status to `error` with the user message.

### 4.6. Configuration Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `CHUNK_SIZE` | 2800 chars | ~700 tokens per chunk |
| `CHUNK_OVERLAP` | 200 chars | Context continuity between chunks |
| `MAX_CHUNKS` | 20 | Limits processing for large documents |
| `MAX_RETRIES` | 3 | Gemini API retry attempts |
| `BASE_DELAY_MS` | 2000 | Exponential backoff base |
| `DEFAULT_PROCESSOR` | `pure_nlp` | Default concept extraction method |

---

## 5. React Query Hook — `useConcepts.ts`

A new hook module at `src/hooks/useConcepts.ts` for concept data access.

### 5.1. Types

- **`Concept`** — Mirrors the `concepts` table (id, document_id, chunk_id, name, description, category, importance, related_concepts, difficulty_level, keywords, timestamps).

### 5.2. Query Keys

```typescript
conceptKeys = {
    all: ['concepts'],
    lists: () => ['concepts', 'list'],
    listByDocument: (documentId) => ['concepts', 'list', { documentId }],
    details: () => ['concepts', 'detail'],
    detail: (id) => ['concepts', 'detail', id],
}
```

### 5.3. Queries

- **`useDocumentConcepts(documentId)`** — Fetches all concepts for a specific document, ordered by importance DESC.
- **`useAllConcepts()`** — Fetches all concepts across all user documents.
- **`useConcept(conceptId)`** — Fetches a single concept by ID.
- **`useConceptsByCategory(documentId)`** — Returns concepts grouped by category (uses `useDocumentConcepts` internally).

### 5.4. Display Utilities

- **`getDifficultyColor(difficulty)`** — Returns CSS classes for difficulty badges (green/yellow/red).
- **`getImportanceColor(importance)`** — Returns background opacity based on importance score.

---

## 6. Frontend UI — FileViewer (`src/components/files/FileViewer.tsx`)

The file detail page, updated to display Phase 3 output.

### 6.1. Document Summary

Shows the extracted/generated summary at the top of the file view. Applies text cleaning for mojibake artifacts.

### 6.2. Concept Cards

Displays extracted concepts as expandable cards:
- **Collapsed**: name, category badge, difficulty badge, importance bar.
- **Expanded**: full description, keywords list.
- Sorted by importance (highest first).
- Keyword highlighting in the document text view.

### 6.3. Document Text View

Renders the original extracted text with:
- Keyword highlighting — concept keywords are highlighted inline using regex matching.
- Sentence splitting for readable paragraphs.
- Mojibake cleanup (`â€™` → `'`, etc.).

### 6.4. Processing Actions

- **Process** button — for pending/error documents, triggers `useProcessDocument()`.
- **Refine with Gemini** button — for ready documents processed by Pure NLP, re-processes with `processor: 'gemini'` override.
- **Generate Quiz** button — triggers quiz generation (Phase 4 integration point).
- **Download** button — downloads the original file via signed URL.

### 6.5. Status Display

Shows document status with appropriate styling:
- **Pending**: yellow badge, "Process" action.
- **Processing**: blue badge with animation, disabled actions.
- **Ready**: green badge, all actions available.
- **Error**: red badge with error message, "Retry" action.

---

## 7. Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/002_document_processing.sql` | chunks, concepts, document_embeddings tables + pgvector + match_documents() |
| `supabase/migrations/003_add_original_text.sql` | original_text column on documents |
| `supabase/migrations/004_add_processed_by.sql` | processed_by column on documents |
| `supabase/functions/process-document/index.ts` | Edge Function: download, extract, chunk, analyze, embed |
| `nlp-service/main.py` | NLP microservice: Tika extraction, TextRank, KeyBERT |
| `nlp-service/Dockerfile` | Docker build for NLP service |
| `nlp-service/requirements.txt` | Python dependencies |
| `nlp-service/logging_config.py` | Logging configuration |
| `src/hooks/useConcepts.ts` | React Query hooks for concept data |

## 8. Files Modified

| File | Change |
|------|--------|
| `src/components/files/FileViewer.tsx` | Display summary, concepts, keyword highlighting, processing actions |
| `src/components/files/FilesContent.tsx` | Process and Refine actions per document |
| `src/hooks/useDocuments.ts` | Added useProcessDocument() mutation |

---

## 9. How to Deploy Phase 3

1. **Apply database migrations** in order:
   - `supabase/migrations/002_document_processing.sql` (enables pgvector, creates 3 tables)
   - `supabase/migrations/003_add_original_text.sql`
   - `supabase/migrations/004_add_processed_by.sql`
2. **Deploy the Edge Function**:
   - `supabase functions deploy process-document` (ensure `GEMINI_API_KEY` and `NLP_SERVICE_URL` are set in Supabase project secrets)
3. **Deploy the NLP Service**:
   - Build and deploy the Docker image from `nlp-service/`
   - Set `NLP_SERVICE_URL` environment variable on the Edge Function to point to the deployed service
4. **Rebuild the frontend**: The new TypeScript files and modified components will be included automatically

---

## 10. Verification Checklist

- Upload a PDF document
  - Verify: NLP service extracts text via Tika
  - Verify: document status transitions: pending → processing → ready
  - Verify: `chunks` rows created with chunked text
  - Verify: `concepts` rows created with names, descriptions, keywords
  - Verify: `document_embeddings` rows created (if GEMINI_API_KEY is set)
  - Verify: `documents.original_text` is populated
  - Verify: `documents.summary` and `documents.concept_count` are set
  - Verify: `documents.processed_by` is set to `pure_nlp` or `gemini`

- View the file detail page (`/files/:id`)
  - Verify: summary is displayed
  - Verify: concept cards show with name, description, category, difficulty, importance
  - Verify: keywords are highlighted in the text view

- Process without NLP service
  - Verify: fallback text extraction works for TXT/MD files
  - Verify: PDF fallback shows appropriate error if text can't be extracted

- Re-process with Gemini
  - Click "Refine with Gemini" on a Pure NLP-processed document
  - Verify: concepts and summary are updated
  - Verify: `processed_by` changes to `gemini`

- Error handling
  - Upload an empty file → verify "empty document" error
  - Disconnect NLP service → verify error state with user-friendly message
  - Verify document can be retried after error

With these pieces in place, **Phase 3 -- Document Processing Pipeline is fully implemented** and provides the extracted concepts and embeddings that power quiz generation (Phase 4), learning analytics (Phase 5), and AI tutor chat (Phase 6).
