-- =====================================================
-- EDUCOACH Database Migration
-- Phase 6 Remediation: AI Tutor Security + Citations + Recency
-- Date: 2026-03-26
-- =====================================================

-- 1) Persist full source citation objects for assistant replies
ALTER TABLE public.chat_messages
    ADD COLUMN IF NOT EXISTS source_citations JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) Keep conversation ordering accurate by touching updated_at whenever a message is inserted
CREATE OR REPLACE FUNCTION public.touch_chat_conversation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.chat_conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_chat_conv_on_message_insert ON public.chat_messages;
CREATE TRIGGER touch_chat_conv_on_message_insert
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_chat_conversation_updated_at();

-- 3) User-scoped semantic retrieval for AI tutor (prevents cross-user retrieval)
CREATE OR REPLACE FUNCTION public.match_documents_for_user(
    query_embedding vector(768),
    p_user_id UUID,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_document_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    chunk_id UUID,
    content_preview TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        de.id,
        de.document_id,
        de.chunk_id,
        de.content_preview,
        1 - (de.embedding <=> query_embedding) AS similarity
    FROM public.document_embeddings de
    INNER JOIN public.documents d
        ON d.id = de.document_id
    WHERE
        d.user_id = p_user_id
        AND (filter_document_id IS NULL OR de.document_id = filter_document_id)
        AND 1 - (de.embedding <=> query_embedding) > match_threshold
    ORDER BY de.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 4) Backfill citations for existing assistant messages where chunk IDs already exist
WITH citation_backfill AS (
    SELECT
        m.id AS message_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'documentId', c.document_id,
                    'documentTitle', COALESCE(d.title, 'Unknown Document'),
                    'chunkId', c.id,
                    'chunkPreview', LEFT(c.content, 150),
                    'similarity', COALESCE(m.similarity_scores[ci.ordinality], 0)
                )
                ORDER BY ci.ordinality
            ) FILTER (WHERE c.id IS NOT NULL),
            '[]'::jsonb
        ) AS citations
    FROM public.chat_messages m
    LEFT JOIN LATERAL unnest(m.retrieved_chunk_ids) WITH ORDINALITY AS ci(chunk_id, ordinality)
        ON TRUE
    LEFT JOIN public.chunks c
        ON c.id = ci.chunk_id
    LEFT JOIN public.documents d
        ON d.id = c.document_id
    WHERE m.role = 'assistant'
    GROUP BY m.id
)
UPDATE public.chat_messages m
SET source_citations = cb.citations
FROM citation_backfill cb
WHERE m.id = cb.message_id
  AND (m.source_citations IS NULL OR m.source_citations = '[]'::jsonb);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Adds:
--   - chat_messages.source_citations (JSONB)
--   - message insert trigger that updates chat_conversations.updated_at
--   - match_documents_for_user() for user-scoped semantic search
--   - citation backfill for historical assistant messages
-- =====================================================
