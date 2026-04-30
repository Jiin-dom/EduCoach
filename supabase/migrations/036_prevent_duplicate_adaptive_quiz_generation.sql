-- =====================================================
-- EDUCOACH Database Migration
-- 036: Prevent duplicate adaptive quiz generation races
--
-- Add source adaptive task linkage on quizzes so concurrent
-- generation requests for the same task can be de-duplicated.
-- =====================================================

ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS source_adaptive_task_id UUID
REFERENCES public.adaptive_study_tasks(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quizzes_source_adaptive_task
ON public.quizzes(source_adaptive_task_id);

-- Guardrail: only one active generating quiz per adaptive task.
-- Keep this narrow to avoid conflicts with historical ready/error rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_quizzes_generating_per_source_adaptive_task
ON public.quizzes(source_adaptive_task_id)
WHERE source_adaptive_task_id IS NOT NULL
  AND status = 'generating';
