-- =====================================================
-- EDUCOACH Database Migration
-- 028: Preserve user-rescheduled adaptive study task dates
-- =====================================================

ALTER TABLE public.adaptive_study_tasks
    ADD COLUMN IF NOT EXISTS user_scheduled_date DATE;

CREATE OR REPLACE FUNCTION public.archive_adaptive_study_task(
    p_user_id UUID,
    p_document_id UUID,
    p_task_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
        p_user_id,
        p_document_id,
        p_task_key,
        split_part(p_task_key, ':', 1),
        'archived',
        NULL,
        NULL,
        NULL,
        0.0000,
        '{}'::UUID[],
        0,
        NULL,
        '{}'::jsonb,
        NOW()
    )
    ON CONFLICT (user_id, task_key) DO UPDATE
    SET status = 'archived',
        reason = NULL,
        scheduled_date = NULL,
        user_scheduled_date = NULL,
        priority_score = 0.0000,
        concept_ids = '{}'::UUID[],
        concept_count = 0,
        linked_quiz_id = NULL,
        metadata = '{}'::jsonb,
        last_synced_at = NOW(),
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_adaptive_study_tasks_for_document(
    p_user_id UUID,
    p_document_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_concept_ids UUID[] := '{}'::UUID[];
    v_concept_count INTEGER := 0;
    v_reason TEXT := NULL;
    v_scheduled_date DATE := NULL;
    v_priority_score NUMERIC(5,4) := 0.0000;
    v_latest_concept_attempt_at TIMESTAMPTZ := NULL;
    v_generating_quiz_id UUID := NULL;
    v_ready_quiz_id UUID := NULL;
    v_ready_quiz_created_at TIMESTAMPTZ := NULL;
    v_ready_quiz_attempts INTEGER := 0;
    v_quiz_status TEXT := 'pending_generation';
    v_linked_quiz_id UUID := NULL;
    v_total_flashcards INTEGER := 0;
    v_due_flashcards INTEGER := 0;
BEGIN
    IF p_user_id IS NULL OR p_document_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        COALESCE(array_agg(t.concept_id), '{}'::UUID[]),
        COUNT(*),
        CASE
            WHEN BOOL_OR(t.has_attempt AND t.due_date <= CURRENT_DATE) THEN 'due_today'
            WHEN BOOL_OR(t.has_attempt AND t.mastery_level = 'needs_review') THEN 'needs_review'
            WHEN COUNT(*) > 0 THEN 'developing'
            ELSE NULL
        END,
        MIN(t.due_date),
        COALESCE(MAX(t.priority_score), 0.0000),
        MAX(t.last_attempt_at)
    INTO
        v_concept_ids,
        v_concept_count,
        v_reason,
        v_scheduled_date,
        v_priority_score,
        v_latest_concept_attempt_at
    FROM (
        SELECT
            ucm.concept_id,
            ucm.mastery_level,
            ucm.due_date,
            ucm.priority_score,
            ucm.last_attempt_at,
            (COALESCE(ucm.total_attempts, 0) > 0) AS has_attempt
        FROM public.user_concept_mastery ucm
        WHERE ucm.user_id = p_user_id
          AND ucm.document_id = p_document_id
          AND (
              ucm.due_date <= CURRENT_DATE
              OR ucm.mastery_level IN ('needs_review', 'developing')
          )
        ORDER BY
            CASE
                WHEN ucm.due_date <= CURRENT_DATE THEN 0
                WHEN ucm.mastery_level = 'needs_review' THEN 1
                ELSE 2
            END,
            ucm.priority_score DESC
        LIMIT 6
    ) AS t;

    IF v_concept_count = 0 THEN
        PERFORM public.archive_adaptive_study_task(p_user_id, p_document_id, format('quiz:%s', p_document_id));
        PERFORM public.archive_adaptive_study_task(p_user_id, p_document_id, format('flashcards:%s', p_document_id));
        PERFORM public.archive_adaptive_study_task(p_user_id, p_document_id, format('review:%s', p_document_id));
        RETURN;
    END IF;

    SELECT q.id
    INTO v_generating_quiz_id
    FROM public.quizzes q
    WHERE q.user_id = p_user_id
      AND q.document_id = p_document_id
      AND q.status = 'generating'
      AND q.title ILIKE 'Review Quiz:%'
    ORDER BY q.created_at DESC
    LIMIT 1;

    SELECT q.id, q.created_at
    INTO v_ready_quiz_id, v_ready_quiz_created_at
    FROM public.quizzes q
    WHERE q.user_id = p_user_id
      AND q.document_id = p_document_id
      AND q.status = 'ready'
      AND q.title ILIKE 'Review Quiz:%'
    ORDER BY q.created_at DESC
    LIMIT 1;

    IF v_generating_quiz_id IS NOT NULL THEN
        v_quiz_status := 'generating';
        v_linked_quiz_id := v_generating_quiz_id;
    ELSIF v_ready_quiz_id IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_ready_quiz_attempts
        FROM public.attempts a
        WHERE a.user_id = p_user_id
          AND a.quiz_id = v_ready_quiz_id
          AND a.completed_at IS NOT NULL;

        IF v_ready_quiz_attempts = 0
           OR v_latest_concept_attempt_at IS NULL
           OR v_ready_quiz_created_at >= v_latest_concept_attempt_at THEN
            v_quiz_status := 'ready';
            v_linked_quiz_id := v_ready_quiz_id;
        ELSE
            v_quiz_status := 'pending_generation';
            v_linked_quiz_id := NULL;
        END IF;
    END IF;

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
        p_user_id,
        p_document_id,
        format('quiz:%s', p_document_id),
        'quiz',
        v_quiz_status,
        v_reason,
        v_scheduled_date,
        NULL,
        v_priority_score,
        v_concept_ids,
        v_concept_count,
        v_linked_quiz_id,
        jsonb_build_object(
            'questionCount', GREATEST(5, LEAST(12, v_concept_count * 2))
        ),
        NOW()
    )
    ON CONFLICT (user_id, task_key) DO UPDATE
    SET document_id = EXCLUDED.document_id,
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        scheduled_date = COALESCE(adaptive_study_tasks.user_scheduled_date, EXCLUDED.scheduled_date),
        user_scheduled_date = adaptive_study_tasks.user_scheduled_date,
        priority_score = EXCLUDED.priority_score,
        concept_ids = EXCLUDED.concept_ids,
        concept_count = EXCLUDED.concept_count,
        linked_quiz_id = EXCLUDED.linked_quiz_id,
        metadata = EXCLUDED.metadata,
        last_synced_at = NOW(),
        updated_at = NOW();

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE f.due_date IS NULL OR f.due_date <= NOW())
    INTO
        v_total_flashcards,
        v_due_flashcards
    FROM public.flashcards f
    WHERE f.user_id = p_user_id
      AND f.document_id = p_document_id
      AND (
          f.concept_id IS NULL
          OR f.concept_id = ANY(v_concept_ids)
      );

    IF v_total_flashcards > 0 THEN
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
            p_user_id,
            p_document_id,
            format('flashcards:%s', p_document_id),
            'flashcards',
            'ready',
            v_reason,
            v_scheduled_date,
            NULL,
            v_priority_score,
            v_concept_ids,
            v_concept_count,
            NULL,
            jsonb_build_object(
                'totalCount', v_total_flashcards,
                'dueCount', v_due_flashcards
            ),
            NOW()
        )
        ON CONFLICT (user_id, task_key) DO UPDATE
        SET document_id = EXCLUDED.document_id,
            status = EXCLUDED.status,
            reason = EXCLUDED.reason,
            scheduled_date = COALESCE(adaptive_study_tasks.user_scheduled_date, EXCLUDED.scheduled_date),
            user_scheduled_date = adaptive_study_tasks.user_scheduled_date,
            priority_score = EXCLUDED.priority_score,
            concept_ids = EXCLUDED.concept_ids,
            concept_count = EXCLUDED.concept_count,
            linked_quiz_id = NULL,
            metadata = EXCLUDED.metadata,
            last_synced_at = NOW(),
            updated_at = NOW();
    ELSE
        PERFORM public.archive_adaptive_study_task(p_user_id, p_document_id, format('flashcards:%s', p_document_id));
    END IF;

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
        p_user_id,
        p_document_id,
        format('review:%s', p_document_id),
        'review',
        'ready',
        v_reason,
        v_scheduled_date,
        NULL,
        v_priority_score,
        v_concept_ids,
        v_concept_count,
        NULL,
        '{}'::jsonb,
        NOW()
    )
    ON CONFLICT (user_id, task_key) DO UPDATE
    SET document_id = EXCLUDED.document_id,
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        scheduled_date = COALESCE(adaptive_study_tasks.user_scheduled_date, EXCLUDED.scheduled_date),
        user_scheduled_date = adaptive_study_tasks.user_scheduled_date,
        priority_score = EXCLUDED.priority_score,
        concept_ids = EXCLUDED.concept_ids,
        concept_count = EXCLUDED.concept_count,
        linked_quiz_id = NULL,
        metadata = '{}'::jsonb,
        last_synced_at = NOW(),
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_adaptive_study_task(
    p_task_id UUID,
    p_new_date DATE
)
RETURNS public.adaptive_study_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task public.adaptive_study_tasks%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_task_id IS NULL OR p_new_date IS NULL THEN
        RAISE EXCEPTION 'Task id and date are required';
    END IF;

    UPDATE public.adaptive_study_tasks
    SET scheduled_date = p_new_date,
        user_scheduled_date = p_new_date,
        updated_at = NOW()
    WHERE id = p_task_id
      AND user_id = auth.uid()
      AND status <> 'archived'
    RETURNING * INTO v_task;

    IF v_task.id IS NULL THEN
        RAISE EXCEPTION 'Adaptive task not found or cannot be edited';
    END IF;

    RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_adaptive_study_task(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_adaptive_study_task(UUID, DATE) TO authenticated;
