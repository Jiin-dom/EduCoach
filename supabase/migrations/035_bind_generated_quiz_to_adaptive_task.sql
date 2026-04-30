-- =====================================================
-- EDUCOACH Database Migration
-- 035: Bind generated quiz to adaptive task
--
-- Prevent repeated auto-generation by linking newly generated
-- quizzes back to their source adaptive task and updating status.
-- =====================================================

CREATE OR REPLACE FUNCTION public.bind_generated_quiz_to_adaptive_task(
    p_task_id UUID,
    p_quiz_id UUID,
    p_status TEXT DEFAULT 'generating'
)
RETURNS public.adaptive_study_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_task public.adaptive_study_tasks%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_task_id IS NULL OR p_quiz_id IS NULL THEN
        RAISE EXCEPTION 'Task id and quiz id are required';
    END IF;

    IF p_status NOT IN ('pending_generation', 'generating', 'ready') THEN
        RAISE EXCEPTION 'Invalid adaptive task status: %', p_status;
    END IF;

    UPDATE public.adaptive_study_tasks
    SET linked_quiz_id = p_quiz_id,
        status = p_status,
        updated_at = NOW(),
        last_synced_at = NOW()
    WHERE id = p_task_id
      AND user_id = v_user_id
      AND status <> 'archived'
    RETURNING * INTO v_task;

    IF v_task.id IS NULL THEN
        RAISE EXCEPTION 'Adaptive task not found or cannot be updated';
    END IF;

    RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_generated_quiz_to_adaptive_task(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bind_generated_quiz_to_adaptive_task(UUID, UUID, TEXT) TO authenticated;
