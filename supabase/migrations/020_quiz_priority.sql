-- =====================================================
-- EDUCOACH Database Migration
-- Phase 7: Quiz Priority Flags (Free vs Premium)
-- =====================================================

ALTER TABLE public.quizzes
    ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE public.quizzes
    ADD COLUMN IF NOT EXISTS priority_tier TEXT NOT NULL DEFAULT 'free';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'quizzes_priority_check'
          AND conrelid = 'public.quizzes'::regclass
    ) THEN
        ALTER TABLE public.quizzes
            ADD CONSTRAINT quizzes_priority_check CHECK (priority IN (1, 2));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'quizzes_priority_tier_check'
          AND conrelid = 'public.quizzes'::regclass
    ) THEN
        ALTER TABLE public.quizzes
            ADD CONSTRAINT quizzes_priority_tier_check CHECK (priority_tier IN ('free', 'premium'));
    END IF;
END $$;

UPDATE public.quizzes
SET
    priority = COALESCE(priority, 1),
    priority_tier = CASE WHEN COALESCE(priority, 1) = 2 THEN 'premium' ELSE 'free' END
WHERE priority IS NULL
   OR priority_tier IS NULL
   OR priority_tier NOT IN ('free', 'premium');

CREATE INDEX IF NOT EXISTS idx_quizzes_priority_status_created
    ON public.quizzes(priority DESC, status, created_at);
