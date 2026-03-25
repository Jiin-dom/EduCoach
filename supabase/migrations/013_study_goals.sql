-- =====================================================
-- EDUCOACH Database Migration
-- 013: Study Goals
-- =====================================================
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.study_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Goal definition
    title TEXT NOT NULL,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('topic_mastery', 'quiz_count', 'overall_mastery')),
    target_value INTEGER NOT NULL,       -- e.g. 80 for 80%, or 10 for 10 quizzes

    -- Optional: which concept this goal is about (for topic_mastery)
    concept_id UUID REFERENCES public.concepts(id) ON DELETE CASCADE,

    -- Optional deadline
    deadline DATE,

    -- Completion tracking
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sg_user_id
    ON public.study_goals(user_id);

CREATE INDEX IF NOT EXISTS idx_sg_user_completed
    ON public.study_goals(user_id, is_completed);

ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
    ON public.study_goals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
    ON public.study_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
    ON public.study_goals FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
    ON public.study_goals FOR DELETE
    USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_study_goals_updated_at ON public.study_goals;
CREATE TRIGGER update_study_goals_updated_at
    BEFORE UPDATE ON public.study_goals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE
-- Table: study_goals
-- =====================================================
