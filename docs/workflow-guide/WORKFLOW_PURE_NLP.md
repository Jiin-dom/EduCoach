# EDUCOACH - Updated Workflow (Pure NLP Default)

> **Last Updated:** January 24, 2026  
> **Default Processor:** Pure NLP (spaCy + TextRank + KeyBERT)  
> **Optional Refinement:** Gemini (manual or fallback)

---

## Application Overview

EDUCOACH is a personalized learning platform that lets students upload study materials and generate:
- Summaries and key concepts
- Quizzes and flashcards (planned)
- Learning path guidance and analytics (planned)

The document analysis pipeline now defaults to **Pure NLP** for deterministic, fast extraction. Gemini is still available for optional refinement.

---

## Tech Stack (Current)

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript |
| UI Components | shadcn/ui (Radix primitives) |
| State Management | React Query (TanStack Query) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| NLP Processing | FastAPI microservice + Apache Tika + spaCy + TextRank + KeyBERT |
| Optional AI | Google Gemini (concept refinement + embeddings) |
| Vector Search | pgvector (HNSW index) |

---

## User Flow (Updated)

1. Upload a study file (PDF, DOCX, TXT, MD).
2. System processes with **Pure NLP** by default.
3. Results show summary + extracted concepts.
4. Optional: **Refine with Gemini** for deeper AI analysis.

UI entry points for refinement:
- File detail view (Document header actions)
- Files list actions (per document)

---

## Document Processing (Updated Default)

### Default Processor: Pure NLP
- Extract text (Apache Tika via NLP service)
- Rank sentences (TextRank)
- Extract keywords (KeyBERT)
- Map ranked sentences -> concepts
- Summary from top sentences

### Optional Processor: Gemini
- Triggered by UI "Refine with Gemini" or by a `processor: 'gemini'` override
- Generates higher-level summary and concept set
- Uses Gemini embeddings if API key is set

---

## Edge Function Processor Override

`process-document` accepts an optional `processor` field:

```json
{
  "documentId": "<uuid>",
  "processor": "gemini" // or "pure_nlp"
}
```

If omitted, the function follows the default (Pure NLP).

---

## Environment Variables (Updated)

**Supabase Edge Functions**
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NLP_SERVICE_URL=https://nlp.edu-coach.tech
DEFAULT_PROCESSOR=pure_nlp
USE_PURE_NLP=true  # optional legacy switch
GEMINI_API_KEY=... # optional (required for Gemini + embeddings)
```

---

## Database Updates

The `documents` table may include:
- `processed_by` (text): tracks `pure_nlp` or `gemini`

Migration file:
- `educoach/supabase/migrations/004_add_processed_by.sql`

---

## Implementation Status

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 1 | Authentication & Database | DONE |
| Phase 2 | User Profiling | DONE |
| Phase 2 | File Upload to Storage | DONE |
| Phase 3 | Pure NLP Document Processing | DONE |
| Phase 3 | Gemini Refinement (Optional) | DONE |
| Phase 4 | Quiz Generation | TODO |
| Phase 4 | Flashcard Generation | TODO |
| Phase 5 | Learning Path Scheduling | TODO |
| Phase 5 | Analytics & Progress Tracking | TODO |

---

*Updated workflow for Pure NLP default processing.*
