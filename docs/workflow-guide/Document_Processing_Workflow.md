# EduCoach - Document Upload & AI Extraction Workflow

This document describes the complete workflow from file upload to AI-powered concept extraction, now that the NLP microservice is deployed on DigitalOcean.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    EduCoach Frontend (React + Vite)                     │    │
│  │  • UploadPage.tsx                                                       │    │
│  │  • useDocuments.ts (React Query)                                        │    │
│  │  • storage.ts (Supabase Storage client)                                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE CLOUD                                     │
│  ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐          │
│  │ Supabase Storage  │   │   PostgreSQL DB   │   │  Edge Functions   │          │
│  │  (documents)      │   │   (documents,     │   │  (process-        │          │
│  │                   │   │    chunks,        │   │   document)       │          │
│  │                   │   │    concepts,      │   │                   │          │
│  │                   │   │    embeddings)    │   │                   │          │
│  └───────────────────┘   └───────────────────┘   └─────────┬─────────┘          │
└────────────────────────────────────────────────────────────┬────────────────────┘
                                                             │
                                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    DIGITALOCEAN DROPLET ($12/mo)                                │
│          https://nlp.edu-coach.tech (165.232.160.101)                          │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                        Nginx (SSL/HTTPS)                                  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                       │
│                                         ▼                                       │
│  ┌───────────────────────┐         ┌───────────────────────┐                   │
│  │     NLP Service       │────────▶│    Apache Tika        │                   │
│  │     (Python/FastAPI)  │         │    (Java)             │                   │
│  │     Port: 5000        │         │    Port: 9998         │                   │
│  │                       │         │                       │                   │
│  │  • /health            │         │  PDF/DOCX parsing     │                   │
│  │  • /extract           │         │  Text extraction      │                   │
│  │  • /textrank          │         │                       │                   │
│  │  • /keywords          │         │                       │                   │
│  │  • /process           │         └───────────────────────┘                   │
│  │                       │                                                      │
│  │  Uses:                │                                                      │
│  │  • spaCy (TextRank)   │                                                      │
│  │  • KeyBERT            │                                                      │
│  └───────────────────────┘                                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                    ┌───────────────────────────────────┐
                    │        Google Gemini AI           │
                    │   (Concept Extraction, Summaries) │
                    │   Model: gemini-2.5-flash-lite    │
                    └───────────────────────────────────┘
```

---

## Complete Workflow

### Phase 1: File Upload (Frontend)

**Files involved:**
- `src/components/UploadPage.tsx` (UI)
- `src/lib/storage.ts` (Supabase Storage helpers)
- `src/hooks/useDocuments.ts` (React Query mutations)

**Steps:**

```
1. User selects file (PDF, DOCX, TXT, or MD)
         │
         ▼
2. Frontend validates file type & size
         │
         ▼
3. File uploaded to Supabase Storage
   └─► Bucket: "documents"
   └─► Path: "{user_id}/{unique_id}_{filename}"
         │
         ▼
4. Document record created in PostgreSQL
   └─► Table: "documents"
   └─► Status: "pending"
   └─► Columns: id, user_id, title, file_name, file_path, file_type, status
         │
         ▼
5. Frontend calls useProcessDocument() hook
   └─► Triggers: supabase.functions.invoke('process-document')
```

---

### Phase 2: Edge Function Processing

**File:** `supabase/functions/process-document/index.ts`

**Steps:**

```
6. Edge Function receives request with documentId
         │
         ▼
7. Update document status to "processing"
         │
         ▼
8. Download file from Supabase Storage
   └─► supabase.storage.from('documents').download(file_path)
         │
         ▼
9. Check if NLP_SERVICE_URL is configured
   ├─► YES → Send to NLP Microservice (Step 10)
   └─► NO  → Use fallback text extraction (limited)
```

---

### Phase 3: NLP Microservice Processing

**File:** `nlp-service/main.py`  
**Endpoint:** `POST https://nlp.edu-coach.tech/process`

**Steps:**

```
10. Edge Function sends file to NLP Service
    └─► POST /process with file in FormData
          │
          ▼
11. NLP Service → Apache Tika (Text Extraction)
    └─► PUT http://tika:9998/tika
    └─► Returns: Raw extracted text
          │
          ▼
12. NLP Service → spaCy + TextRank (Sentence Ranking)
    └─► Loads: en_core_web_sm model
    └─► Returns: Top 10 most important sentences
          │
          ▼
13. NLP Service → KeyBERT (Keyword Extraction)
    └─► BERT-based semantic similarity
    └─► Returns: Top 15 keyphrases (1-3 words)
          │
          ▼
14. NLP Service returns JSON:
    {
      "success": true,
      "text": "Extracted plain text...",
      "keywords": ["machine learning", "neural networks", ...],
      "important_sentences": ["Key sentence 1...", ...],
      "char_count": 15234
    }
```

---

### Phase 4: AI Concept Extraction (Gemini)

**Back to:** `supabase/functions/process-document/index.ts`

**Steps:**

```
15. Edge Function receives NLP response
          │
          ▼
16. Save original_text to database (for caching/RAG)
          │
          ▼
17. Chunk text into segments
    └─► CHUNK_SIZE: 1000 characters (~200 words)
    └─► CHUNK_OVERLAP: 100 characters
    └─► MAX_CHUNKS: 20
          │
          ▼
18. Save chunks to database
    └─► Table: "chunks"
    └─► Columns: document_id, content, chunk_index, token_count
          │
          ▼
19. Call Gemini AI for concept extraction
    ├─► Small doc (1 chunk) → processSingleDocument()
    └─► Large doc (multiple chunks) → processChunkedDocument()
          │
          ▼
20. Gemini analyzes each chunk:
    └─► Prompt: "You are an expert academic tutor..."
    └─► Returns: JSON with concepts
    {
      "summary": "Document summary...",
      "concepts": [
        {
          "name": "Concept Name",
          "description": "What this means...",
          "category": "Category",
          "importance": 8,
          "difficulty_level": "intermediate",
          "keywords": ["term1", "term2"]
        }
      ]
    }
          │
          ▼
21. For multi-chunk docs: combineChunkResults()
    └─► Merges all chunk summaries
    └─► Deduplicates concepts by name
    └─► Keeps highest importance score
```

---

### Phase 5: Embeddings Generation

**Steps:**

```
22. Generate embeddings for each chunk
    └─► Model: text-embedding-004 (768 dimensions)
    └─► Processes in batches of 5
    └─► 500ms delay between batches (rate limiting)
          │
          ▼
23. Save embeddings to database
    └─► Table: "document_embeddings"
    └─► Columns: document_id, chunk_id, embedding, content_preview
    └─► Used for: Semantic search, RAG queries
```

---

### Phase 6: Finalize & Update

**Steps:**

```
24. Save concepts to database
    └─► Table: "concepts"
    └─► Columns: document_id, name, description, category,
                 importance, difficulty_level, keywords
          │
          ▼
25. Update document record
    └─► status: "ready"
    └─► summary: AI-generated summary
    └─► concept_count: Number of extracted concepts
    └─► error_message: null
          │
          ▼
26. Edge Function returns success response
    {
      "success": true,
      "message": "Document processed successfully",
      "conceptCount": 12,
      "chunkCount": 5,
      "wasTruncated": false,
      "processingTimeMs": 15234
    }
```

---

### Phase 7: Frontend Updates

**Steps:**

```
27. useProcessDocument() receives success response
          │
          ▼
28. React Query invalidates document cache
    └─► queryClient.invalidateQueries({ queryKey: documentKeys.all })
          │
          ▼
29. UI refreshes to show:
    └─► Document status: "ready" ✓
    └─► Summary displayed
    └─► Concept count shown
    └─► "Study", "Quiz" buttons enabled
```

---

## Data Flow Summary

```
PDF/DOCX File
    │
    ▼
[Supabase Storage] ──────────────────────────────────┐
    │                                                │
    ▼                                                │
[Edge Function] ◄────────────────────────────────────┘
    │
    ▼
[NLP Service @ nlp.edu-coach.tech]
    │   ├── Text Extraction (Tika)
    │   ├── Sentence Ranking (TextRank)
    │   └── Keyword Extraction (KeyBERT)
    │
    ▼
[Gemini AI]
    │   ├── Summary Generation
    │   └── Concept Extraction
    │
    ▼
[Database]
    ├── documents (status, summary)
    ├── chunks (text segments)
    ├── concepts (extracted knowledge)
    └── document_embeddings (for search)
    │
    ▼
[Frontend UI]
    └── Ready to Study! 🎓
```

---

## API Endpoints Reference

### NLP Service (DigitalOcean)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `https://nlp.edu-coach.tech/health` | GET | Health check |
| `https://nlp.edu-coach.tech/extract` | POST | Extract text only |
| `https://nlp.edu-coach.tech/textrank` | POST | Rank sentences |
| `https://nlp.edu-coach.tech/keywords` | POST | Extract keywords |
| `https://nlp.edu-coach.tech/process` | POST | Full pipeline (used by Edge Function) |

### Supabase Edge Function

| Endpoint | Method | Description |
|----------|--------|-------------|
| `process-document` | POST | Main document processing function |

---

## Error Handling

The system includes comprehensive error handling:

| Error Code | Description | User Message |
|------------|-------------|--------------|
| `CONFIG_ERROR` | Missing API keys | "AI service is not configured" |
| `DOC_NOT_FOUND` | Document deleted | "Document could not be found" |
| `STORAGE_ERROR` | Download failed | "Failed to download file" |
| `EMPTY_DOC` | No text extracted | "Document appears to be empty" |
| `NLP_SERVICE_ERROR` | NLP service down | "Could not connect to text extraction service" |
| `AI_BUSY` | Gemini 503 | "AI service is currently busy" |
| `AI_RATE_LIMIT` | Gemini 429 | "Too many requests" |
| `AI_SAFETY` | Content flagged | "Document was flagged by content safety" |

---

## Performance Metrics

Typical processing times:

| Stage | Duration |
|-------|----------|
| File Upload | 1-3 seconds |
| Edge Function Trigger | < 1 second |
| NLP Processing (Tika + TextRank + KeyBERT) | 5-15 seconds |
| Gemini AI (per chunk) | 2-5 seconds |
| Embeddings Generation | 3-10 seconds |
| **Total (average document)** | **15-30 seconds** |

---

## Configuration

### Environment Variables

**Supabase Edge Functions:**
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
GEMINI_API_KEY=xxx
NLP_SERVICE_URL=https://nlp.edu-coach.tech
```

**NLP Service (Docker):**
```
TIKA_URL=http://tika:9998
```

---

## Database Schema

```sql
-- Main documents table
documents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  title TEXT,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,          -- 'pdf', 'docx', 'txt', 'md'
  status TEXT,             -- 'pending', 'processing', 'ready', 'error'
  summary TEXT,
  original_text TEXT,      -- Cached extracted text
  concept_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ
)

-- Text chunks for processing
chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents,
  content TEXT,
  chunk_index INTEGER,
  token_count INTEGER
)

-- Extracted concepts
concepts (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents,
  name TEXT,
  description TEXT,
  category TEXT,
  importance INTEGER,
  difficulty_level TEXT,
  keywords TEXT[]
)

-- Vector embeddings for semantic search
document_embeddings (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents,
  chunk_id UUID REFERENCES chunks,
  embedding VECTOR(768),
  content_preview TEXT
)
```

---

## Deployment Status

| Component | Status | URL |
|-----------|--------|-----|
| Frontend | Deployed | (Vercel or localhost) |
| Supabase | Deployed | https://xxx.supabase.co |
| NLP Service | ✅ Deployed | https://nlp.edu-coach.tech |
| Apache Tika | ✅ Running | Internal (port 9998) |
| Gemini AI | ✅ Configured | Via API Key |

---

*Last Updated: January 22, 2026*
