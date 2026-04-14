-- =====================================================
-- EDUCOACH Database Migration
-- 023: In-App Notifications (Web-First)
-- =====================================================

-- 1) Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (
        type IN (
            'document_ready',
            'document_error',
            'quiz_ready',
            'quiz_error',
            'quiz_attempt_completed',
            'deadline_reminder',
            'exam_reminder',
            'trial_started',
            'trial_reminder',
            'trial_ended',
            'subscription_changed',
            'ai_tutor_quota_warning',
            'ai_tutor_quota_reached',
            'mastery_level_up',
            'mastery_level_down',
            'progress_milestone',
            'streak_milestone'
        )
    ),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    cta_route TEXT,
    entity_type TEXT,
    entity_id UUID,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    dedupe_key TEXT,
    CONSTRAINT notifications_user_dedupe_key_uniq UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
    ON public.notifications (user_id, read_at, created_at DESC);

-- Required by plan: explicit index on (user_id, dedupe_key)
CREATE INDEX IF NOT EXISTS idx_notifications_user_dedupe
    ON public.notifications (user_id, dedupe_key);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage notifications" ON public.notifications;
CREATE POLICY "Service role can manage notifications"
    ON public.notifications FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Guard user-side updates: users may only update read_at.
CREATE OR REPLACE FUNCTION public.guard_notification_user_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.cta_route IS DISTINCT FROM OLD.cta_route
       OR NEW.entity_type IS DISTINCT FROM OLD.entity_type
       OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
       OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.dedupe_key IS DISTINCT FROM OLD.dedupe_key THEN
        RAISE EXCEPTION 'Only read state can be updated by users';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_notification_user_updates ON public.notifications;
CREATE TRIGGER guard_notification_user_updates
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_notification_user_updates();

-- 2) Helper API for deterministic notifications with optional dedupe
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_cta_route TEXT DEFAULT NULL,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
    p_dedupe_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Authenticated users can only create notifications for themselves';
    END IF;

    WITH inserted AS (
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            body,
            cta_route,
            entity_type,
            entity_id,
            payload,
            expires_at,
            dedupe_key
        ) VALUES (
            p_user_id,
            p_type,
            p_title,
            p_body,
            p_cta_route,
            p_entity_type,
            p_entity_id,
            COALESCE(p_payload, '{}'::jsonb),
            p_expires_at,
            p_dedupe_key
        )
        ON CONFLICT (user_id, dedupe_key) DO NOTHING
        RETURNING id
    )
    SELECT id INTO v_id FROM inserted;

    IF v_id IS NULL AND p_dedupe_key IS NOT NULL THEN
        SELECT n.id
        INTO v_id
        FROM public.notifications n
        WHERE n.user_id = p_user_id
          AND n.dedupe_key = p_dedupe_key
        LIMIT 1;
    END IF;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TIMESTAMPTZ, TEXT) TO service_role;

-- 3) Trigger emitters
CREATE OR REPLACE FUNCTION public.notify_document_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'ready' THEN
        PERFORM public.create_notification(
            NEW.user_id,
            'document_ready',
            'Study Material Ready',
            format('"%s" has finished processing and is ready to review.', NEW.title),
            format('/files/%s', NEW.id),
            'document',
            NEW.id,
            jsonb_build_object('documentTitle', NEW.title, 'status', NEW.status),
            NOW() + INTERVAL '90 days',
            format('document_status:%s:%s', NEW.id, NEW.status)
        );
    ELSIF NEW.status = 'error' THEN
        PERFORM public.create_notification(
            NEW.user_id,
            'document_error',
            'Document Processing Failed',
            format('We could not process "%s". You can retry from Files.', NEW.title),
            '/files',
            'document',
            NEW.id,
            jsonb_build_object('documentTitle', NEW.title, 'status', NEW.status, 'error', NEW.error_message),
            NOW() + INTERVAL '90 days',
            format('document_status:%s:%s:%s', NEW.id, NEW.status, COALESCE(NEW.updated_at::text, NOW()::text))
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_document_status_change ON public.documents;
CREATE TRIGGER trg_notify_document_status_change
    AFTER UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_document_status_change();

CREATE OR REPLACE FUNCTION public.notify_quiz_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'ready' THEN
        PERFORM public.create_notification(
            NEW.user_id,
            'quiz_ready',
            'Quiz Ready',
            format('"%s" is ready. Start your quiz anytime.', NEW.title),
            format('/quizzes/%s', NEW.id),
            'quiz',
            NEW.id,
            jsonb_build_object('quizTitle', NEW.title, 'status', NEW.status),
            NOW() + INTERVAL '90 days',
            format('quiz_status:%s:%s', NEW.id, NEW.status)
        );
    ELSIF NEW.status = 'error' THEN
        PERFORM public.create_notification(
            NEW.user_id,
            'quiz_error',
            'Quiz Generation Failed',
            format('We could not generate "%s". Please retry.', NEW.title),
            '/quizzes',
            'quiz',
            NEW.id,
            jsonb_build_object('quizTitle', NEW.title, 'status', NEW.status, 'error', NEW.error_message),
            NOW() + INTERVAL '90 days',
            format('quiz_status:%s:%s:%s', NEW.id, NEW.status, COALESCE(NEW.updated_at::text, NOW()::text))
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_quiz_status_change ON public.quizzes;
CREATE TRIGGER trg_notify_quiz_status_change
    AFTER UPDATE ON public.quizzes
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_quiz_status_change();

CREATE OR REPLACE FUNCTION public.compute_user_quiz_streak(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    WITH quiz_days AS (
        SELECT DISTINCT (completed_at AT TIME ZONE 'Asia/Manila')::date AS day
        FROM public.attempts
        WHERE user_id = p_user_id
          AND completed_at IS NOT NULL
    ),
    ordered AS (
        SELECT day, ROW_NUMBER() OVER (ORDER BY day DESC) AS rn
        FROM quiz_days
    )
    SELECT COALESCE(COUNT(*), 0)::int
    FROM ordered
    WHERE day = ((NOW() AT TIME ZONE 'Asia/Manila')::date - ((rn - 1)::int));
$$;

CREATE OR REPLACE FUNCTION public.notify_attempt_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_quiz_title TEXT;
    v_total_quizzes INT;
    v_streak INT;
BEGIN
    IF NEW.completed_at IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT q.title INTO v_quiz_title
    FROM public.quizzes q
    WHERE q.id = NEW.quiz_id;

    PERFORM public.create_notification(
        NEW.user_id,
        'quiz_attempt_completed',
        'Quiz Completed',
        format(
            'You scored %s%% on "%s" (%s/%s correct).',
            COALESCE(ROUND(NEW.score)::text, '0'),
            COALESCE(v_quiz_title, 'your quiz'),
            NEW.correct_answers,
            NEW.total_questions
        ),
        format('/quizzes/%s?review=true', NEW.quiz_id),
        'attempt',
        NEW.id,
        jsonb_build_object(
            'quizId', NEW.quiz_id,
            'score', NEW.score,
            'correctAnswers', NEW.correct_answers,
            'totalQuestions', NEW.total_questions
        ),
        NOW() + INTERVAL '90 days',
        format('attempt:%s', NEW.id)
    );

    SELECT COUNT(*)::int
    INTO v_total_quizzes
    FROM public.attempts a
    WHERE a.user_id = NEW.user_id
      AND a.completed_at IS NOT NULL;

    IF v_total_quizzes IN (1, 3, 5, 10, 20, 50) THEN
        PERFORM public.create_notification(
            NEW.user_id,
            'progress_milestone',
            'Progress Milestone',
            format('Great work. You have completed %s quizzes.', v_total_quizzes),
            '/quizzes',
            'system',
            NULL,
            jsonb_build_object('quizzesCompleted', v_total_quizzes),
            NOW() + INTERVAL '90 days',
            format('progress_quizzes:%s', v_total_quizzes)
        );
    END IF;

    v_streak := public.compute_user_quiz_streak(NEW.user_id);
    IF v_streak IN (3, 7, 14, 30) THEN
        PERFORM public.create_notification(
            NEW.user_id,
            'streak_milestone',
            'Study Streak Milestone',
            format('You reached a %s-day quiz streak. Keep it going.', v_streak),
            '/dashboard',
            'system',
            NULL,
            jsonb_build_object('streakDays', v_streak),
            NOW() + INTERVAL '90 days',
            format('streak:%s:%s', v_streak, (NOW() AT TIME ZONE 'Asia/Manila')::date)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_attempt_insert ON public.attempts;
CREATE TRIGGER trg_notify_attempt_insert
    AFTER INSERT ON public.attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_attempt_insert();

CREATE OR REPLACE FUNCTION public.notify_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_trial_end_date DATE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.trial_started_at IS NOT NULL AND NEW.trial_ends_at IS NOT NULL THEN
            v_trial_end_date := (NEW.trial_ends_at AT TIME ZONE 'Asia/Manila')::date;
            PERFORM public.create_notification(
                NEW.user_id,
                'trial_started',
                '14-Day Premium Trial Started',
                format('Your premium trial is active and ends on %s.', v_trial_end_date),
                '/subscription',
                'subscription',
                NEW.id,
                jsonb_build_object('plan', NEW.plan, 'status', NEW.status, 'trialEndsAt', NEW.trial_ends_at),
                NOW() + INTERVAL '90 days',
                format('trial_started:%s:%s', NEW.user_id, v_trial_end_date)
            );
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.trial_started_at IS NOT NULL
           AND NEW.trial_ends_at IS NOT NULL
           AND (OLD.trial_started_at IS NULL OR OLD.trial_ends_at IS DISTINCT FROM NEW.trial_ends_at) THEN
            v_trial_end_date := (NEW.trial_ends_at AT TIME ZONE 'Asia/Manila')::date;
            PERFORM public.create_notification(
                NEW.user_id,
                'trial_started',
                '14-Day Premium Trial Started',
                format('Your premium trial is active and ends on %s.', v_trial_end_date),
                '/subscription',
                'subscription',
                NEW.id,
                jsonb_build_object('plan', NEW.plan, 'status', NEW.status, 'trialEndsAt', NEW.trial_ends_at),
                NOW() + INTERVAL '90 days',
                format('trial_started:%s:%s', NEW.user_id, v_trial_end_date)
            );
        END IF;

        IF NEW.plan IS DISTINCT FROM OLD.plan OR NEW.status IS DISTINCT FROM OLD.status THEN
            PERFORM public.create_notification(
                NEW.user_id,
                'subscription_changed',
                'Subscription Updated',
                format('Your plan is now "%s" (%s).', NEW.plan, NEW.status),
                '/subscription',
                'subscription',
                NEW.id,
                jsonb_build_object('previousPlan', OLD.plan, 'newPlan', NEW.plan, 'previousStatus', OLD.status, 'newStatus', NEW.status),
                NOW() + INTERVAL '90 days',
                format('subscription_changed:%s:%s:%s:%s', NEW.user_id, NEW.plan, NEW.status, NOW()::date)
            );
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subscription_change ON public.subscriptions;
CREATE TRIGGER trg_notify_subscription_change
    AFTER INSERT OR UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_subscription_change();

CREATE OR REPLACE FUNCTION public.notify_mastery_level_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_concept_name TEXT;
    v_old_rank INT;
    v_new_rank INT;
    v_direction TEXT;
BEGIN
    IF TG_OP <> 'UPDATE' OR NEW.mastery_level IS NOT DISTINCT FROM OLD.mastery_level THEN
        RETURN NEW;
    END IF;

    SELECT c.name INTO v_concept_name
    FROM public.concepts c
    WHERE c.id = NEW.concept_id;

    v_old_rank := CASE OLD.mastery_level WHEN 'needs_review' THEN 1 WHEN 'developing' THEN 2 ELSE 3 END;
    v_new_rank := CASE NEW.mastery_level WHEN 'needs_review' THEN 1 WHEN 'developing' THEN 2 ELSE 3 END;
    v_direction := CASE WHEN v_new_rank > v_old_rank THEN 'up' ELSE 'down' END;

    IF v_direction = 'up' THEN
        PERFORM public.create_notification(
            NEW.user_id,
            'mastery_level_up',
            'Mastery Level Up',
            format('"%s" moved to %s.', COALESCE(v_concept_name, 'A concept'), REPLACE(NEW.mastery_level, '_', ' ')),
            '/learning-path',
            'concept',
            NEW.concept_id,
            jsonb_build_object('conceptName', v_concept_name, 'from', OLD.mastery_level, 'to', NEW.mastery_level),
            NOW() + INTERVAL '90 days',
            format('mastery_up:%s:%s:%s', NEW.user_id, NEW.concept_id, NOW()::date)
        );
    ELSE
        PERFORM public.create_notification(
            NEW.user_id,
            'mastery_level_down',
            'Mastery Needs Attention',
            format('"%s" moved to %s. A quick review is recommended.', COALESCE(v_concept_name, 'A concept'), REPLACE(NEW.mastery_level, '_', ' ')),
            '/learning-path',
            'concept',
            NEW.concept_id,
            jsonb_build_object('conceptName', v_concept_name, 'from', OLD.mastery_level, 'to', NEW.mastery_level),
            NOW() + INTERVAL '90 days',
            format('mastery_down:%s:%s:%s', NEW.user_id, NEW.concept_id, NOW()::date)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mastery_level_change ON public.user_concept_mastery;
CREATE TRIGGER trg_notify_mastery_level_change
    AFTER UPDATE ON public.user_concept_mastery
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_mastery_level_change();

-- 4) Scheduled reminder generator (D-3, D-1, D0, overdue)
CREATE OR REPLACE FUNCTION public.generate_reminder_notifications(
    p_reference_date DATE DEFAULT ((NOW() AT TIME ZONE 'Asia/Manila')::date)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_doc RECORD;
    v_trial RECORD;
    v_days_until INT;
    v_due_date DATE;
    v_title TEXT;
    v_body TEXT;
    v_tag TEXT;
BEGIN
    -- Study deadline reminders (documents.deadline)
    FOR v_doc IN
        SELECT d.id, d.user_id, d.title, d.deadline
        FROM public.documents d
        WHERE d.deadline IS NOT NULL
    LOOP
        v_due_date := (v_doc.deadline AT TIME ZONE 'Asia/Manila')::date;
        v_days_until := v_due_date - p_reference_date;

        v_title := NULL;
        v_body := NULL;
        v_tag := NULL;

        IF v_days_until = 3 THEN
            v_title := 'Deadline in 3 Days';
            v_body := format('"%s" is due in 3 days (%s).', v_doc.title, v_due_date);
            v_tag := 'd-3';
        ELSIF v_days_until = 1 THEN
            v_title := 'Deadline Tomorrow';
            v_body := format('"%s" is due tomorrow (%s).', v_doc.title, v_due_date);
            v_tag := 'd-1';
        ELSIF v_days_until = 0 THEN
            v_title := 'Deadline Today';
            v_body := format('"%s" is due today.', v_doc.title);
            v_tag := 'd0';
        ELSIF v_days_until = -1 THEN
            v_title := 'Deadline Overdue';
            v_body := format('"%s" was due on %s. Consider reviewing it now.', v_doc.title, v_due_date);
            v_tag := 'overdue';
        END IF;

        IF v_title IS NOT NULL THEN
            PERFORM public.create_notification(
                v_doc.user_id,
                'deadline_reminder',
                v_title,
                v_body,
                format('/files/%s', v_doc.id),
                'document',
                v_doc.id,
                jsonb_build_object('dueDate', v_due_date, 'tag', v_tag),
                NOW() + INTERVAL '90 days',
                format('deadline_reminder:%s:%s:%s', v_doc.id, v_tag, p_reference_date)
            );
        END IF;
    END LOOP;

    -- Exam reminders (documents.exam_date)
    FOR v_doc IN
        SELECT d.id, d.user_id, d.title, d.exam_date
        FROM public.documents d
        WHERE d.exam_date IS NOT NULL
    LOOP
        v_due_date := (v_doc.exam_date AT TIME ZONE 'Asia/Manila')::date;
        v_days_until := v_due_date - p_reference_date;

        v_title := NULL;
        v_body := NULL;
        v_tag := NULL;

        IF v_days_until = 3 THEN
            v_title := 'Exam in 3 Days';
            v_body := format('"%s" exam is in 3 days (%s).', v_doc.title, v_due_date);
            v_tag := 'd-3';
        ELSIF v_days_until = 1 THEN
            v_title := 'Exam Tomorrow';
            v_body := format('"%s" exam is tomorrow (%s).', v_doc.title, v_due_date);
            v_tag := 'd-1';
        ELSIF v_days_until = 0 THEN
            v_title := 'Exam Today';
            v_body := format('"%s" exam is today.', v_doc.title);
            v_tag := 'd0';
        ELSIF v_days_until = -1 THEN
            v_title := 'Exam Date Passed';
            v_body := format('"%s" exam date was %s. Update your plan if needed.', v_doc.title, v_due_date);
            v_tag := 'overdue';
        END IF;

        IF v_title IS NOT NULL THEN
            PERFORM public.create_notification(
                v_doc.user_id,
                'exam_reminder',
                v_title,
                v_body,
                '/learning-path',
                'document',
                v_doc.id,
                jsonb_build_object('examDate', v_due_date, 'tag', v_tag),
                NOW() + INTERVAL '90 days',
                format('exam_reminder:%s:%s:%s', v_doc.id, v_tag, p_reference_date)
            );
        END IF;
    END LOOP;

    -- Trial reminders + trial ended reminders
    FOR v_trial IN
        SELECT s.id, s.user_id, s.plan, s.status, s.trial_ends_at
        FROM public.subscriptions s
        WHERE s.trial_ends_at IS NOT NULL
    LOOP
        v_due_date := (v_trial.trial_ends_at AT TIME ZONE 'Asia/Manila')::date;
        v_days_until := v_due_date - p_reference_date;

        IF v_days_until = 3 THEN
            PERFORM public.create_notification(
                v_trial.user_id,
                'trial_reminder',
                'Trial Ends in 3 Days',
                format('Your premium trial ends on %s. Upgrade anytime to keep premium access.', v_due_date),
                '/subscription',
                'subscription',
                v_trial.id,
                jsonb_build_object('trialEndsAt', v_due_date, 'tag', 'd-3'),
                NOW() + INTERVAL '90 days',
                format('trial_reminder:%s:d-3:%s', v_trial.user_id, p_reference_date)
            );
        ELSIF v_days_until = 1 THEN
            PERFORM public.create_notification(
                v_trial.user_id,
                'trial_reminder',
                'Trial Ends Tomorrow',
                format('Your premium trial ends tomorrow (%s).', v_due_date),
                '/subscription',
                'subscription',
                v_trial.id,
                jsonb_build_object('trialEndsAt', v_due_date, 'tag', 'd-1'),
                NOW() + INTERVAL '90 days',
                format('trial_reminder:%s:d-1:%s', v_trial.user_id, p_reference_date)
            );
        ELSIF v_days_until = 0 THEN
            PERFORM public.create_notification(
                v_trial.user_id,
                'trial_reminder',
                'Trial Ends Today',
                'Your premium trial ends today.',
                '/subscription',
                'subscription',
                v_trial.id,
                jsonb_build_object('trialEndsAt', v_due_date, 'tag', 'd0'),
                NOW() + INTERVAL '90 days',
                format('trial_reminder:%s:d0:%s', v_trial.user_id, p_reference_date)
            );
        ELSIF v_days_until = -1 AND v_trial.plan = 'free' THEN
            PERFORM public.create_notification(
                v_trial.user_id,
                'trial_ended',
                'Trial Ended',
                'Your premium trial has ended. You are now on Free access.',
                '/subscription',
                'subscription',
                v_trial.id,
                jsonb_build_object('trialEndsAt', v_due_date),
                NOW() + INTERVAL '90 days',
                format('trial_ended:%s:%s', v_trial.user_id, v_due_date)
            );
        END IF;
    END LOOP;
END;
$$;

-- 5) Retention cleanup helper (90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
BEGIN
    DELETE FROM public.notifications n
    WHERE n.created_at < NOW() - INTERVAL '90 days'
       OR (n.expires_at IS NOT NULL AND n.expires_at < NOW());

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

-- 6) Optional pg_cron registration (safe no-op if extension is unavailable)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Unschedule old jobs if they exist to keep migrations idempotent.
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'educoach_notification_reminders_daily') THEN
            PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'educoach_notification_reminders_daily' LIMIT 1));
        END IF;

        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'educoach_notification_cleanup_daily') THEN
            PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'educoach_notification_cleanup_daily' LIMIT 1));
        END IF;

        -- 00:05 Manila ~= 16:05 UTC previous day.
        PERFORM cron.schedule(
            'educoach_notification_reminders_daily',
            '5 16 * * *',
            'SELECT public.generate_reminder_notifications();'
        );

        PERFORM cron.schedule(
            'educoach_notification_cleanup_daily',
            '35 16 * * *',
            'SELECT public.cleanup_old_notifications();'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Keep migration non-blocking on environments without pg_cron access.
        RAISE NOTICE 'pg_cron schedule setup skipped: %', SQLERRM;
END;
$$;
