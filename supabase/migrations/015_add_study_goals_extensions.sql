-- =====================================================
-- EDUCOACH Database Migration
-- 015: Study Goals Extensions
-- =====================================================
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- Add the new foreign key columns loosely
-- We keep the original 3 goal types ('topic_mastery', 'quiz_count', 'overall_mastery')
-- but add these columns to allow 'topic_mastery' to target a document
-- and 'quiz_count' to target a specific quiz.
ALTER TABLE public.study_goals ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE;
ALTER TABLE public.study_goals ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
