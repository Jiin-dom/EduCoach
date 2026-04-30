-- =====================================================
-- EDUCOACH Database Migration
-- 034: Crystallize virtual adaptive task via RPC
--
-- Allow authenticated users to persist virtual adaptive
-- tasks without granting broad INSERT on the table.
-- =====================================================

CREATE OR REPLACE FUNCTION public.crystallize_adaptive_study_task(
    p_document_id UUID,
    p_task_type TEXT,
    p_reason TEXT,
    p_new_date DATE,
    p_priority_score NUMERIC,
    p_concept_ids UUID[],
    p_concept_count INTEGER,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_virtual_source_id TEXT DEFAULT NULL
)
RETURNS public.adaptive_study_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_task public.adaptive_study_tasks%ROWTYPE;
    v_task_key TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_document_id IS NULL OR p_new_date IS NULL THEN
        RAISE EXCEPTION 'Document id and date are required';
    END IF;

    IF p_task_type NOT IN ('quiz', 'flashcards', 'review') THEN
        RAISE EXCEPTION 'Invalid task type: %', p_task_type;
    END IF;

    IF p_reason NOT IN ('due_today', 'needs_review', 'developing') THEN
        RAISE EXCEPTION 'Invalid task reason: %', p_reason;
    END IF;

    IF p_concept_ids IS NULL OR COALESCE(array_length(p_concept_ids, 1), 0) = 0 THEN
        RAISE EXCEPTION 'At least one concept is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = p_document_id
          AND d.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Document not found or not owned by user';
    END IF;

    v_task_key := COALESCE(
        NULLIF(p_virtual_source_id, ''),
        format('manual:%s:%s:%s', p_task_type, p_document_id, p_new_date)
    );

    INSERT INTO public.adaptive_study_tasks (
        user_id,
        document_id,
        task_key,
        task_type,
        status,
        reason,
        scheduled_date,
        user_scheduled_date,
        priority_score,
        concept_ids,
        concept_count,
        linked_quiz_id,
        metadata,
        last_synced_at
    )
    VALUES (
        v_user_id,
        p_document_id,
        format('manual:%s', v_task_key),
        p_task_type,
        'pending_generation',
        p_reason,
        p_new_date,
        p_new_date,
        COALESCE(p_priority_score, 0),
        p_concept_ids,
        GREATEST(1, COALESCE(p_concept_count, COALESCE(array_length(p_concept_ids, 1), 1))),
        NULL,
        COALESCE(p_metadata, '{}'::jsonb),
        NOW()
    )
    ON CONFLICT (user_id, task_key) DO UPDATE
    SET scheduled_date = EXCLUDED.scheduled_date,
        user_scheduled_date = EXCLUDED.user_scheduled_date,
        priority_score = EXCLUDED.priority_score,
        concept_ids = EXCLUDED.concept_ids,
        concept_count = EXCLUDED.concept_count,
        metadata = EXCLUDED.metadata,
        status = 'pending_generation',
        linked_quiz_id = NULL,
        last_synced_at = NOW(),
        updated_at = NOW()
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.crystallize_adaptive_study_task(
    UUID,
    TEXT,
    TEXT,
    DATE,
    NUMERIC,
    UUID[],
    INTEGER,
    JSONB,
    TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.crystallize_adaptive_study_task(
    UUID,
    TEXT,
    TEXT,
    DATE,
    NUMERIC,
    UUID[],
    INTEGER,
    JSONB,
    TEXT
) TO authenticated;
