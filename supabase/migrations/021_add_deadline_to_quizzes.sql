-- =====================================================
-- EDUCOACH Database Migration
-- Phase 6: Add Deadline to Quizzes
-- =====================================================

-- 1. ADD DEADLINE COLUMN TO QUIZZES
-- This allows assigning a target completion date to specific quizzes.
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

-- 2. ADD INDEX FOR PERFORMANCE
-- Helps with sorting quizzes by deadline in the Study Goals panel.
CREATE INDEX IF NOT EXISTS idx_quizzes_deadline ON public.quizzes(deadline);

-- 3. COMMENT ON COLUMN
COMMENT ON COLUMN public.quizzes.deadline IS 'Target completion date for the quiz.';
