# Embedding Model Migration: text-embedding-004 -> gemini-embedding-001

**Date**: February 28, 2026
**Reason**: Google deprecated `text-embedding-004` on January 14, 2026. The model returns HTTP 404 on the `v1beta` endpoint. Replaced with `gemini-embedding-001`.

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/ai-tutor/index.ts` | Embedding model + outputDimensionality |
| `supabase/functions/process-document/index.ts` | Embedding model, chunk size, batch config |
| `docs/completed/phase-6-ai-tutor-chat-rag.md` | Documentation references updated |

---

## Embedding Model Change

| Setting | Before | After |
|---------|--------|-------|
| Model | `text-embedding-004` | `gemini-embedding-001` |
| Default dimensions | 768 | 3072 |
| Requested dimensions | N/A (768 was default) | `outputDimensionality: 768` |
| Max input tokens | ~8000 chars | 2048 tokens (~8000 chars) |
| API endpoint | `v1beta/models/text-embedding-004:embedContent` | `v1beta/models/gemini-embedding-001:embedContent` |

`gemini-embedding-001` defaults to 3072 dimensions but supports Matryoshka Representation Learning (MRL), allowing reduced output via the `outputDimensionality` parameter. We request 768 to match the existing `vector(768)` column in `document_embeddings` and the `match_documents()` function. No database schema change needed.

---

## Chunk Size Change (process-document)

| Setting | Before | After | Reason |
|---------|--------|-------|--------|
| `CHUNK_SIZE` | 1000 chars (~250 tokens) | 2800 chars (~700 tokens) | 500-800 token sweet spot for RAG retrieval quality |
| `CHUNK_OVERLAP` | 100 chars | 200 chars | Proportional increase for context continuity |
| `MAX_CHUNKS` | 20 | 20 (unchanged) | |

Larger chunks give the LLM more surrounding context per retrieval hit. The 500-800 token range balances retrieval precision (not too large) with answer quality (not too fragmented).

---

## Embedding Batch Config Change (process-document)

| Setting | Before | After | Reason |
|---------|--------|-------|--------|
| Batch size | 5 concurrent | 3 concurrent | Safer for RPM=100 limit |
| Batch delay | 500ms | 1500ms | Respect TPM=30K with bigger chunks |

### Rate Limit Budget (gemini-embedding-001 free tier)

| Limit | Value | Our Usage (20 chunks max) |
|-------|-------|--------------------------|
| RPM (requests/min) | 100 | ~20 requests per document |
| TPM (tokens/min) | 30,000 | ~14,000 tokens per document (20 x 700) |
| RPD (requests/day) | 1,000 | ~20 per document, allows ~50 documents/day |

With batch size 3 and 1.5s delay: ~7 batches per document, completing in ~10 seconds. Stays well within all three limits even under concurrent usage.

---

## AI Tutor Change (ai-tutor)

| Setting | Before | After |
|---------|--------|-------|
| `EMBEDDING_MODEL` | `text-embedding-004` | `gemini-embedding-001` |
| `EMBEDDING_DIMENSIONS` | N/A | `768` (new constant) |
| `outputDimensionality` in request body | Not set | `768` |
| `MAX_CHUNKS` (retrieval) | 6 | 6 (unchanged) |

Each chat question makes exactly 1 embedding API call. At RPM=100, this supports up to 100 questions per minute -- more than enough for an MVP.

---

## Required Action After Deployment

Existing document embeddings in `document_embeddings` were generated with `text-embedding-004`. These vectors are **incompatible** with `gemini-embedding-001` query vectors (different model = different vector space). Cosine similarity will return incorrect results.

### Steps:

1. Deploy both Edge Functions:
   ```
   supabase functions deploy process-document
   supabase functions deploy ai-tutor
   ```
2. Reprocess every existing document through the UI (click reprocess on each file). This clears old chunks + embeddings and regenerates them with the new model and chunk size.
3. Verify the AI chat works by asking a question about a reprocessed document.

### What reprocessing does:

- Deletes old `document_embeddings`, `concepts`, and `chunks` rows for that document
- Re-chunks the text at the new 2800-char size
- Re-extracts concepts
- Re-generates embeddings with `gemini-embedding-001` at 768 dimensions
- Quiz data and mastery scores from previous phases are unaffected (they reference `concepts` by ID, which get new IDs after reprocessing, but `user_concept_mastery` uses `ON DELETE CASCADE` so stale mastery rows are cleaned up automatically)
