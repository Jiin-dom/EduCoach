# EduCoach - Document Processing Workflow (Pure NLP Default)

> **Last Updated:** January 24, 2026  
> **Default Pipeline:** Pure NLP  
> **Optional Refinement:** Gemini (manual override)

---

## System Architecture (Updated)

```
+--------------------------------------------------------------------------------+
|                                USER'S BROWSER                                  |
|  +--------------------------------------------------------------------------+  |
|  |                EduCoach Frontend (React + Vite)                           |  |
|  |  - FileUploadDialog.tsx                                                   |  |
|  |  - FileViewer.tsx / FilesContent.tsx                                      |  |
|  |  - useDocuments.ts (React Query)                                          |  |
|  +--------------------------------------------------------------------------+  |
+----------------------------------------+---------------------------------------+
                                         |
                                         v
+--------------------------------------------------------------------------------+
|                                SUPABASE CLOUD                                  |
|  +------------------+   +---------------------+   +------------------------+   |
|  | Storage (docs)   |   | PostgreSQL DB       |   | Edge Function           |   |
|  | documents/{id}   |   | documents/chunks    |   | process-document        |   |
|  +------------------+   +---------------------+   +------------------------+   |
+----------------------------------------+---------------------------------------+
                                         |
                                         v
+--------------------------------------------------------------------------------+
|                    DIGITALOCEAN NLP SERVICE (FastAPI)                          |
|  - Apache Tika (text extraction)                                               |
|  - spaCy + TextRank (sentence ranking)                                         |
|  - KeyBERT (keyword extraction)                                                |
+----------------------------------------+---------------------------------------+
                                         |
                                         v
                     +-----------------------------------------------+
                     | Google Gemini (Optional)                      |
                     | - Refinement + embeddings                      |
                     +-----------------------------------------------+
```

---

## Processing Modes

### 1) Pure NLP (Default)
- Extract text via NLP service (Tika)
- Rank sentences (TextRank)
- Extract keywords (KeyBERT)
- Convert ranked sentences into concept objects
- Build summary from top-ranked sentences

### 2) Gemini (Optional)
- Triggered by UI **Refine with Gemini** or `processor: "gemini"` override
- Generates deeper summary and concept set
- Embeddings generated if `GEMINI_API_KEY` is set

---

## Request Override

`process-document` accepts an optional override:

```json
{
  "documentId": "<uuid>",
  "processor": "gemini" // or "pure_nlp"
}
```

---

## Detailed Workflow

### Phase 1: Upload + Document Record
1. User uploads a document (PDF/DOCX/TXT/MD)
2. File stored in Supabase Storage
3. A `documents` row is created (status: `pending`)

### Phase 2: Edge Function Start
4. `process-document` is invoked with `documentId`
5. Status updated to `processing`
6. Previous derived data (chunks/concepts/embeddings) is cleared

### Phase 3: NLP Extraction
7. Edge function downloads the file
8. NLP service extracts text, keywords, and ranked sentences

### Phase 4: Chunking
9. Text is chunked (default: 1000 chars, 100 overlap)
10. Chunks saved to `chunks`

### Phase 5: Analysis
11. **Pure NLP default:** map ranked sentences -> concepts + summary
12. **Optional Gemini:** if requested, Gemini provides summary + concept list

### Phase 6: Embeddings (Optional)
13. If `GEMINI_API_KEY` is set, embeddings are generated per chunk
14. Embeddings saved to `document_embeddings`

### Phase 7: Finalize
15. Save concepts to `concepts`
16. Update document status to `ready` with summary + `concept_count`
17. If available, set `processed_by` to `pure_nlp` or `gemini`

---

## Key Tables

- `documents` (metadata, status, summary, concept_count, processed_by)
- `chunks` (document chunks)
- `concepts` (extracted concepts)
- `document_embeddings` (optional embeddings)

---

## Environment Variables

```
DEFAULT_PROCESSOR=pure_nlp
USE_PURE_NLP=true            # optional legacy switch
NLP_SERVICE_URL=https://nlp.edu-coach.tech
GEMINI_API_KEY=...           # optional (required for Gemini + embeddings)
```

---

*Updated document processing pipeline for Pure NLP default.*
