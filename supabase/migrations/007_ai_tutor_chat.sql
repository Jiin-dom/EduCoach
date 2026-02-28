-- =====================================================
-- EDUCOACH Database Migration
-- Phase 6: AI Tutor Chat (RAG)
-- =====================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- =====================================================
-- 1. CHAT CONVERSATIONS TABLE
-- Groups messages into conversations. Optionally scoped
-- to a single document for focused Q&A.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,

    title TEXT DEFAULT 'New Conversation',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_user
    ON public.chat_conversations(user_id, updated_at DESC);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
    ON public.chat_conversations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
    ON public.chat_conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
    ON public.chat_conversations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
    ON public.chat_conversations FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage conversations"
    ON public.chat_conversations FOR ALL
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS update_chat_conv_updated_at ON public.chat_conversations;
CREATE TRIGGER update_chat_conv_updated_at
    BEFORE UPDATE ON public.chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. CHAT MESSAGES TABLE
-- Stores every user question and AI response, plus
-- the chunk IDs used to generate the answer for
-- full traceability.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,

    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,

    bloom_level TEXT,
    retrieved_chunk_ids UUID[] DEFAULT '{}',
    similarity_scores FLOAT[] DEFAULT '{}',
    model_used TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_conversation
    ON public.chat_messages(conversation_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
    ON public.chat_messages FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM public.chat_conversations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own messages"
    ON public.chat_messages FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM public.chat_conversations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage messages"
    ON public.chat_messages FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- Tables created:
--   chat_conversations  (groups messages, optional doc scope)
--   chat_messages        (user + assistant messages with RAG traceability)
--
-- Features:
--   RLS policies for user isolation
--   Service role policies for Edge Functions
--   Indexes on common query patterns
--   updated_at trigger on conversations
-- =====================================================
