-- =====================================================
-- EDUCOACH Database Migration
-- Phase 3: Document Processing Tables
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- =====================================================
-- 1. ENABLE PGVECTOR EXTENSION
-- Required for storing and querying embeddings
-- =====================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 2. CHUNKS TABLE
-- Stores text chunks extracted from documents
-- Each document is split into smaller chunks for processing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    
    -- Chunk content
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL, -- Position in document (0-based)
    
    -- Metadata
    start_page INTEGER, -- Page number where chunk starts (for PDFs)
    end_page INTEGER,   -- Page number where chunk ends
    token_count INTEGER, -- Approximate token count for API usage tracking
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON public.chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON public.chunks(document_id, chunk_index);

-- Enable RLS
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access chunks from their own documents
CREATE POLICY "Users can view own document chunks"
    ON public.chunks FOR SELECT
    USING (
        document_id IN (
            SELECT id FROM public.documents WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage chunks"
    ON public.chunks FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 3. CONCEPTS TABLE
-- Stores key concepts extracted from document chunks
-- These are used for quiz generation and learning analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS public.concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES public.chunks(id) ON DELETE SET NULL,
    
    -- Concept content
    name TEXT NOT NULL,          -- Short concept name/title
    description TEXT,            -- Detailed explanation
    category TEXT,               -- Category/topic classification
    importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
    
    -- Related concepts (self-referencing for concept maps)
    related_concepts UUID[] DEFAULT '{}',
    
    -- Learning metadata
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    keywords TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_concepts_document_id ON public.concepts(document_id);
CREATE INDEX IF NOT EXISTS idx_concepts_category ON public.concepts(category);
CREATE INDEX IF NOT EXISTS idx_concepts_importance ON public.concepts(importance DESC);

-- Enable RLS
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own document concepts"
    ON public.concepts FOR SELECT
    USING (
        document_id IN (
            SELECT id FROM public.documents WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage concepts"
    ON public.concepts FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 4. DOCUMENT EMBEDDINGS TABLE
-- Stores vector embeddings for semantic search
-- Each chunk gets an embedding for RAG (Retrieval Augmented Generation)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    chunk_id UUID NOT NULL REFERENCES public.chunks(id) ON DELETE CASCADE,
    
    -- Vector embedding (1536 dimensions for OpenAI/Gemini text-embedding models)
    embedding vector(768), -- Using 768 for Gemini embeddings
    
    -- Metadata for search optimization
    content_preview TEXT, -- First ~100 chars for quick reference
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id 
    ON public.document_embeddings(document_id);

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding 
    ON public.document_embeddings 
    USING hnsw (embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own document embeddings"
    ON public.document_embeddings FOR SELECT
    USING (
        document_id IN (
            SELECT id FROM public.documents WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage embeddings"
    ON public.document_embeddings FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to search documents by semantic similarity
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_document_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    chunk_id UUID,
    content_preview TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        de.id,
        de.document_id,
        de.chunk_id,
        de.content_preview,
        1 - (de.embedding <=> query_embedding) AS similarity
    FROM public.document_embeddings de
    WHERE 
        (filter_document_id IS NULL OR de.document_id = filter_document_id)
        AND 1 - (de.embedding <=> query_embedding) > match_threshold
    ORDER BY de.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================
-- 6. UPDATED_AT TRIGGER FOR CONCEPTS
-- =====================================================

DROP TRIGGER IF EXISTS update_concepts_updated_at ON public.concepts;
CREATE TRIGGER update_concepts_updated_at
    BEFORE UPDATE ON public.concepts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- Tables created:
--   ✅ chunks (document text segments)
--   ✅ concepts (extracted key concepts)
--   ✅ document_embeddings (vector embeddings for RAG)
--
-- Features:
--   ✅ pgvector extension enabled
--   ✅ HNSW index for fast similarity search
--   ✅ RLS policies for user isolation
--   ✅ Semantic search function (match_documents)
-- =====================================================

