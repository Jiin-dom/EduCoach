-- =====================================================
-- EDUCOACH Database Migration
-- Phase: Add original_text column for extracted document text
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- Add original_text column to documents table
-- This stores the extracted text from Tika for:
-- 1. Faster re-processing (no need to re-extract)
-- 2. Full-text search capabilities
-- 3. RAG (Retrieval Augmented Generation) context

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS original_text TEXT;

-- Optional: Add full-text search index (uncomment if needed)
-- CREATE INDEX IF NOT EXISTS idx_documents_original_text_fts 
--     ON public.documents 
--     USING gin(to_tsvector('english', original_text));

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- Added:
--   ✅ original_text column (TEXT) to documents table
-- =====================================================
