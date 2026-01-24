-- =====================================================
-- EDUCOACH Database Migration
-- Phase: Track document processor (pure_nlp vs gemini)
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS processed_by TEXT;

-- Optional: Enforce allowed values (uncomment if you want strict validation)
-- ALTER TABLE public.documents
-- ADD CONSTRAINT documents_processed_by_check
-- CHECK (processed_by IN ('pure_nlp', 'gemini'));

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- Added:
--   ✅ processed_by column (TEXT) to documents table
-- =====================================================
