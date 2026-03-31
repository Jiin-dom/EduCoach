# EDUCOACH - Current Working Workflow

> **Last Updated:** January 18, 2026  
> **Stack:** React + Vite + TypeScript + Supabase + Gemini AI

---

## 📋 Table of Contents

1. [Application Overview](#application-overview)
2. [User Flow Diagram](#user-flow-diagram)
3. [Authentication Flow](#authentication-flow)
4. [Document Processing Pipeline](#document-processing-pipeline)
5. [Database Schema](#database-schema)
6. [API & Services](#api--services)
7. [Page Reference](#page-reference)

---

## Application Overview

EDUCOACH is an AI-powered personalized learning platform that helps students:
- Upload study materials (PDFs, docs, text files)
- Generate AI-extracted concepts and summaries
- Create quizzes and flashcards from materials
- Track learning progress with analytics
- Follow a personalized learning path

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript |
| UI Components | shadcn/ui (Radix primitives) |
| State Management | React Query (TanStack Query) |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| AI Processing | Google Gemini API (gemini-2.5-flash-lite) |
| Embeddings | Gemini text-embedding-004 (768 dimensions) |
| Vector Search | pgvector with HNSW index |

---

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EDUCOACH USER FLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Landing     │────▶│   Register    │────▶│   Profiling   │
│   Page (/)    │     │   (/register) │     │   (/profiling)│
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        │              ┌──────┘                     │
        ▼              ▼                            ▼
┌───────────────┐     ┌───────────────────────────────────────────────────┐
│    Login      │────▶│                  DASHBOARD                        │
│   (/login)    │     │                 (/dashboard)                      │
└───────────────┘     │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
                      │  │ Files   │ │ Quizzes │ │ Learning│ │Analytics│  │
                      │  │ Summary │ │ Summary │ │  Path   │ │ Stats   │  │
                      │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
                      └───────┼───────────┼───────────┼───────────┼───────┘
                              │           │           │           │
                              ▼           ▼           ▼           ▼
                      ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐
                      │   Files   │ │  Quizzes │ │  Learning │ │ Analytics │
                      │  (/files) │ │(/quizzes)│ │   Path    │ │(/analytics│
                      └─────┬─────┘ └────┬─────┘ └───────────┘ └───────────┘
                            │            │
                            ▼            ▼
                      ┌───────────┐ ┌───────────┐
                      │  File     │ │   Quiz    │
                      │  Detail   │ │  Session  │
                      │(/files/:id│ │(/quiz/:id)│
                      └───────────┘ └───────────┘
```

---

## Authentication Flow

### Registration → Login → Profile Setup

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

User visits /register
        │
        ▼
┌───────────────────────────────────────────────────┐
│ RegisterForm.tsx                                   │
│ • Full Name                                        │
│ • Email                                            │
│ • Password (min 6 chars)                           │
│ • Confirm Password                                 │
└───────────────────────────────────────────────────┘
        │
        │ supabase.auth.signUp()                                    
        ▼                                                            
┌───────────────────────────────────────────────────┐
│ Supabase Auth                                      │
│ • Creates user in auth.users                       │
│ • Trigger: handle_new_user() fires               │
│ • Auto-creates row in user_profiles               │
└───────────────────────────────────────────────────┘
        │
        │ Redirect to /profiling
        ▼
┌───────────────────────────────────────────────────┐
│ ProfilingForm.tsx (5 Steps)                       │
│ Step 1: Display Name                               │
│ Step 2: Learning Style (Visual/Auditory/etc)      │
│ Step 3: Study Goal (Exam Prep/Skill Building)     │
│ Step 4: Preferred Subjects (multi-select)         │
│ Step 5: Daily Study Minutes (15-120 min)          │
└───────────────────────────────────────────────────┘
        │
        │ updateProfile({ has_completed_profiling: true })
        ▼
┌───────────────────────────────────────────────────┐
│ Redirect to /dashboard                             │
│ • User is now fully onboarded                     │
│ • Can access all protected routes                 │
└───────────────────────────────────────────────────┘
```

### Protected Route Logic

```typescript
// ProtectedRoute.tsx checks:
if (!user) → Redirect to /login
if (requireProfile && !profile.has_completed_profiling) → Redirect to /profiling
else → Render children
```

---

## Document Processing Pipeline

### Upload → Process → Ready

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT PROCESSING PIPELINE                         │
└─────────────────────────────────────────────────────────────────────────┘

USER UPLOADS FILE
        │
        ▼
┌───────────────────────────────────────────────────┐
│ FileUploadDialog.tsx                              │
│ • Drag & drop or file picker                      │
│ • Validates: PDF, DOCX, TXT, MD (max 10MB)        │
│ • User enters document title                      │
└───────────────────────────────────────────────────┘
        │
        │ uploadFile() → Supabase Storage
        │ INSERT INTO documents (status: 'pending')
        ▼
┌───────────────────────────────────────────────────┐
│ Supabase Storage                                   │
│ Bucket: documents/{user_id}/{timestamp}_{file}    │
└───────────────────────────────────────────────────┘
        │
        │ User clicks "Process Document"
        │ supabase.functions.invoke('process-document')
        ▼
┌───────────────────────────────────────────────────┐
│ Edge Function: process-document                   │
│                                                    │
│ 1. UPDATE documents SET status = 'processing'    │
│ 2. Download file from storage                     │
│ 3. Extract text (PDF parsing or direct read)      │
│ 4. Chunk text (4000 chars, 200 overlap)          │
│ 5. INSERT chunks                                  │
│ 6. Send to Gemini API for analysis               │
│    → Extract concepts (5-15 per document)        │
│    → Generate summary (3-4 sentences)            │
│ 7. INSERT concepts                                │
│ 8. Generate embeddings (per chunk)               │
│ 9. INSERT document_embeddings                     │
│ 10. UPDATE documents SET status = 'ready'         │
└───────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│ Document Ready!                                    │
│ • Summary displayed in FileViewer                 │
│ • Concepts listed with importance/difficulty      │
│ • "Generate Quiz" button enabled                  │
└───────────────────────────────────────────────────┘
```

### Gemini AI Prompts

| Task | Model | Output |
|------|-------|--------|
| Concept Extraction | gemini-2.5-flash-lite | JSON with summary + concepts array |
| Embeddings | text-embedding-004 | 768-dimension vector |

---

## Database Schema

### Tables Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA                                  │
└─────────────────────────────────────────────────────────────────────────┘

auth.users (Supabase Auth)
    │
    │ 1:1
    ▼
┌─────────────────────┐
│   user_profiles     │
├─────────────────────┤
│ id (FK → auth.users)│
│ email               │
│ display_name        │
│ avatar_url          │
│ learning_style      │
│ study_goal          │
│ preferred_subjects[]│
│ daily_study_minutes │
│ has_completed_prof. │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐        ┌─────────────────────┐
│     documents       │        │      concepts       │
├─────────────────────┤   1:N  ├─────────────────────┤
│ id                  │───────▶│ id                  │
│ user_id             │        │ document_id         │
│ title               │        │ name                │
│ file_name           │        │ description         │
│ file_path           │        │ category            │
│ file_type           │        │ importance (1-10)   │
│ file_size           │        │ difficulty_level    │
│ status              │        │ keywords[]          │
│ summary             │        │ related_concepts[]  │
│ concept_count       │        └─────────────────────┘
│ error_message       │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐        ┌─────────────────────┐
│      chunks         │   1:1  │ document_embeddings │
├─────────────────────┤───────▶├─────────────────────┤
│ id                  │        │ id                  │
│ document_id         │        │ document_id         │
│ content             │        │ chunk_id            │
│ chunk_index         │        │ embedding (768 dim) │
│ token_count         │        │ content_preview     │
└─────────────────────┘        └─────────────────────┘
```

### Row Level Security (RLS)

All tables enforce user-level isolation:
```sql
-- Example: Users can only view their own documents
CREATE POLICY "Users can view own documents"
ON documents FOR SELECT
USING (auth.uid() = user_id);
```

---

## API & Services

### Frontend Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useAuth()` | `contexts/AuthContext.tsx` | User session, profile, auth methods |
| `useDocuments()` | `hooks/useDocuments.ts` | Fetch user's documents |
| `useDocument(id)` | `hooks/useDocuments.ts` | Fetch single document |
| `useUploadDocument()` | `hooks/useDocuments.ts` | Upload mutation |
| `useDeleteDocument()` | `hooks/useDocuments.ts` | Delete mutation |
| `useProcessDocument()` | `hooks/useDocuments.ts` | Trigger processing |
| `useDocumentConcepts(id)` | `hooks/useConcepts.ts` | Fetch concepts for doc |
| `useAllConcepts()` | `hooks/useConcepts.ts` | All user's concepts |

### Storage Utilities

| Function | File | Purpose |
|----------|------|---------|
| `uploadFile()` | `lib/storage.ts` | Upload to Supabase Storage |
| `deleteFile()` | `lib/storage.ts` | Delete from Storage |
| `getFileUrl()` | `lib/storage.ts` | Get signed download URL |
| `validateFile()` | `lib/storage.ts` | Check type/size limits |
| `formatFileSize()` | `lib/storage.ts` | Human-readable size |

### Edge Functions

| Function | Path | Trigger |
|----------|------|---------|
| `process-document` | `supabase/functions/process-document` | Manual via UI button |

---

## Page Reference

### Public Pages

| Route | Page | Component |
|-------|------|-----------|
| `/` | Landing Page | `LandingPage.tsx` |
| `/login` | Login | `LoginPage.tsx` → `LoginForm.tsx` |
| `/register` | Register | `RegisterPage.tsx` → `RegisterForm.tsx` |

### Protected Pages (Auth Required)

| Route | Page | Component | Profile Required |
|-------|------|-----------|------------------|
| `/profiling` | User Profiling | `ProfilingPage.tsx` → `ProfilingForm.tsx` | ❌ |
| `/dashboard` | Dashboard | `DashboardPage.tsx` → `DashboardContent.tsx` | ✅ |
| `/files` | File List | `FilesPage.tsx` → `FilesContent.tsx` | ✅ |
| `/files/:id` | File Detail | `FileDetailPage.tsx` → `FileViewer.tsx` | ✅ |
| `/quizzes` | Quiz List | `QuizzesPage.tsx` | ✅ |
| `/quizzes/:id` | Quiz Session | `QuizSessionPage.tsx` | ✅ |
| `/learning-path` | Study Schedule | `LearningPathPage.tsx` | ✅ |
| `/analytics` | Progress Stats | `AnalyticsPage.tsx` | ✅ |
| `/profile` | User Settings | `ProfilePage.tsx` → `ProfileContent.tsx` | ❌ |

---

## Environment Variables

```env
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Supabase Edge Function Secrets (set in dashboard)
GEMINI_API_KEY=your-gemini-api-key
```

---

## Current Implementation Status

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 1 | Authentication & Database | ✅ Complete |
| Phase 2 | User Profiling | ✅ Complete |
| Phase 2 | File Upload to Storage | ✅ Complete |
| Phase 3 | Document Processing (Edge Function) | ✅ Complete |
| Phase 3 | Concept Extraction | ✅ Complete |
| Phase 3 | Embeddings & Semantic Search | ✅ Complete |
| Phase 4 | Quiz Generation | 🔲 Not Started |
| Phase 4 | Flashcard Generation | 🔲 Not Started |
| Phase 5 | Learning Path Scheduling | 🔲 Not Started |
| Phase 5 | Analytics & Progress Tracking | 🔲 Not Started |

---

*Generated by EDUCOACH Development Team*
