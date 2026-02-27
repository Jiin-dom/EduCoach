-- =====================================================
-- EDUCOACH Database Migration
-- Phase 5: Learning Intelligence & Analytics
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- =====================================================
-- 1. QUESTION ATTEMPT LOG TABLE
-- Per-question denormalized log — the most important
-- table for WMS, SM-2, and analytics.
-- Every time a student answers a question, one row.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.question_attempt_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,

    is_correct BOOLEAN NOT NULL,
    user_answer TEXT,
    question_difficulty TEXT CHECK (question_difficulty IN ('beginner', 'intermediate', 'advanced')),
    time_spent_seconds INTEGER,
    attempt_index INTEGER DEFAULT 1,

    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qal_user_concept
    ON public.question_attempt_log(user_id, concept_id);
CREATE INDEX IF NOT EXISTS idx_qal_user_document
    ON public.question_attempt_log(user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_qal_attempted_at
    ON public.question_attempt_log(attempted_at);
CREATE INDEX IF NOT EXISTS idx_qal_attempt_id
    ON public.question_attempt_log(attempt_id);

ALTER TABLE public.question_attempt_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own question logs"
    ON public.question_attempt_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own question logs"
    ON public.question_attempt_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage question logs"
    ON public.question_attempt_log FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 2. USER CONCEPT MASTERY TABLE
-- Stores WMS + SM-2 state per user per concept.
-- This is the single source of truth for "how well
-- does this student know this concept" and "when
-- should they study it next".
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_concept_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,

    -- WMS fields
    mastery_score NUMERIC(5,2) DEFAULT 50,
    confidence NUMERIC(3,2) DEFAULT 0,
    mastery_level TEXT DEFAULT 'needs_review'
        CHECK (mastery_level IN ('needs_review', 'developing', 'mastered')),
    total_attempts INTEGER DEFAULT 0,
    correct_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,

    -- SM-2 fields
    repetition INTEGER DEFAULT 0,
    interval_days INTEGER DEFAULT 0,
    ease_factor NUMERIC(4,2) DEFAULT 2.50,
    due_date DATE DEFAULT CURRENT_DATE,
    last_reviewed_at TIMESTAMPTZ,

    -- Global scheduler
    priority_score NUMERIC(5,4) DEFAULT 0.5000,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_ucm_user_due
    ON public.user_concept_mastery(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_ucm_user_level
    ON public.user_concept_mastery(user_id, mastery_level);
CREATE INDEX IF NOT EXISTS idx_ucm_user_priority
    ON public.user_concept_mastery(user_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_ucm_user_document
    ON public.user_concept_mastery(user_id, document_id);

ALTER TABLE public.user_concept_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mastery"
    ON public.user_concept_mastery FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mastery"
    ON public.user_concept_mastery FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mastery"
    ON public.user_concept_mastery FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage mastery"
    ON public.user_concept_mastery FOR ALL
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS update_ucm_updated_at ON public.user_concept_mastery;
CREATE TRIGGER update_ucm_updated_at
    BEFORE UPDATE ON public.user_concept_mastery
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 3. LEARNING CONFIG TABLE
-- Tunable WMS / SM-2 parameters.
-- One row per user with sensible defaults.
-- Panel can tweak without redeploying.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.learning_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- WMS weights (must sum to ~1.0)
    w_accuracy NUMERIC(3,2) DEFAULT 0.55,
    w_recency NUMERIC(3,2) DEFAULT 0.20,
    w_confidence NUMERIC(3,2) DEFAULT 0.15,
    w_difficulty NUMERIC(3,2) DEFAULT 0.10,

    -- Recency decay
    recency_tau_days INTEGER DEFAULT 7,

    -- Confidence saturation
    confidence_k INTEGER DEFAULT 3,

    -- SM-2 defaults
    sm2_default_ef NUMERIC(4,2) DEFAULT 2.50,

    -- Quality-score mapping thresholds (score% boundaries)
    quality_thresholds JSONB DEFAULT '[90, 80, 65, 50, 30]'::jsonb,

    -- Priority weights
    priority_w_weakness NUMERIC(3,2) DEFAULT 0.65,
    priority_w_deadline NUMERIC(3,2) DEFAULT 0.25,
    priority_w_practice NUMERIC(3,2) DEFAULT 0.10,

    -- Mastery level thresholds
    mastery_threshold_mastered INTEGER DEFAULT 80,
    mastery_threshold_developing INTEGER DEFAULT 60,
    confidence_threshold_mastered NUMERIC(3,2) DEFAULT 0.67,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.learning_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own config"
    ON public.learning_config FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config"
    ON public.learning_config FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
    ON public.learning_config FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage config"
    ON public.learning_config FOR ALL
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS update_learning_config_updated_at ON public.learning_config;
CREATE TRIGGER update_learning_config_updated_at
    BEFORE UPDATE ON public.learning_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- Tables created:
--   question_attempt_log  (per-question denormalized log)
--   user_concept_mastery  (WMS + SM-2 state per concept)
--   learning_config       (tunable algorithm parameters)
--
-- Features:
--   RLS policies for user isolation
--   Service role policies for Edge Functions
--   Indexes on common query patterns
--   updated_at triggers
--   UNIQUE(user_id, concept_id) on mastery table
-- =====================================================
