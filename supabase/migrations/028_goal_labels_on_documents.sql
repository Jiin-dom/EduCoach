-- =====================================================
-- EDUCOACH Database Migration
-- Feature: Custom labels for study goals (calendar display)
-- =====================================================

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS goal_label TEXT;

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS quiz_deadline_label TEXT;

COMMENT ON COLUMN public.documents.goal_label IS 'Optional student-defined label for a file study goal (shown in Learning Path calendar).';
COMMENT ON COLUMN public.documents.quiz_deadline_label IS 'Optional student-defined label for a quiz deadline marker (shown in Learning Path calendar).';

