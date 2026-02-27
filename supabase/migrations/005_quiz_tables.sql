-- =====================================================
-- EDUCOACH Database Migration
-- Phase 4: Quiz Generation & Attempts Tables
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- =====================================================
-- 1. QUIZZES TABLE
-- Stores quiz metadata generated from documents
-- =====================================================

CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    description TEXT,
    question_count INTEGER DEFAULT 0,
    difficulty TEXT DEFAULT 'mixed' CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
    time_limit_minutes INTEGER,

    status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'error')),
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_document_id ON public.quizzes(document_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON public.quizzes(status);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quizzes"
    ON public.quizzes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quizzes"
    ON public.quizzes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quizzes"
    ON public.quizzes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quizzes"
    ON public.quizzes FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage quizzes"
    ON public.quizzes FOR ALL
    USING (true)
    WITH CHECK (true);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_quizzes_updated_at ON public.quizzes;
CREATE TRIGGER update_quizzes_updated_at
    BEFORE UPDATE ON public.quizzes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. QUIZ QUESTIONS TABLE
-- Stores individual questions within a quiz
-- Supports: multiple_choice, identification, true_false, fill_in_blank
-- =====================================================

CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
    source_chunk_id UUID REFERENCES public.chunks(id) ON DELETE SET NULL,

    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'identification', 'true_false', 'fill_in_blank')),
    question_text TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT,

    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    order_index INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_concept_id ON public.quiz_questions(concept_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON public.quiz_questions(quiz_id, order_index);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz questions"
    ON public.quiz_questions FOR SELECT
    USING (
        quiz_id IN (
            SELECT id FROM public.quizzes WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage quiz questions"
    ON public.quiz_questions FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 3. ATTEMPTS TABLE
-- Tracks user quiz attempts and answers
-- =====================================================

CREATE TABLE IF NOT EXISTS public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,

    score NUMERIC(5,2),
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER DEFAULT 0,
    answers JSONB DEFAULT '[]'::jsonb,

    time_taken_seconds INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz_id ON public.attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_quiz ON public.attempts(user_id, quiz_id);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts"
    ON public.attempts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts"
    ON public.attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attempts"
    ON public.attempts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage attempts"
    ON public.attempts FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- Tables created:
--   ✅ quizzes (quiz metadata, linked to documents)
--   ✅ quiz_questions (4 types: MCQ, identification, T/F, fill-in-blank)
--   ✅ attempts (user quiz attempts with detailed answers)
--
-- Features:
--   ✅ RLS policies for user isolation
--   ✅ Service role policies for Edge Functions
--   ✅ Indexes on foreign keys and common queries
--   ✅ updated_at trigger for quizzes
--   ✅ source_chunk_id traceability per Obj3
-- =====================================================
