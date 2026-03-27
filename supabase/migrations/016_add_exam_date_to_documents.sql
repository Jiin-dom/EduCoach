-- =====================================================
-- EDUCOACH Database Migration
-- 016: Add Exam Date to Documents
-- =====================================================
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS exam_date TIMESTAMPTZ;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
