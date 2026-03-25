-- Phase 6.3 patch: unify quiz + flashcard attempt logging in one table.
-- Adds source-aware fields and conditional constraints for question_attempt_log.

-- 1) Add source discriminator + flashcard foreign key.
ALTER TABLE public.question_attempt_log
    ADD COLUMN IF NOT EXISTS source_type TEXT;

ALTER TABLE public.question_attempt_log
    ADD COLUMN IF NOT EXISTS flashcard_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE;

-- 2) Backfill existing rows as quiz events, then enforce not-null + default.
ALTER TABLE public.question_attempt_log
    ALTER COLUMN source_type SET DEFAULT 'quiz';

UPDATE public.question_attempt_log
SET source_type = 'quiz'
WHERE source_type IS NULL;

ALTER TABLE public.question_attempt_log
    ALTER COLUMN source_type SET NOT NULL;

-- 3) Relax quiz-only foreign keys so flashcard events can be stored.
ALTER TABLE public.question_attempt_log
    ALTER COLUMN question_id DROP NOT NULL,
    ALTER COLUMN quiz_id DROP NOT NULL,
    ALTER COLUMN attempt_id DROP NOT NULL;

-- 4) Enforce valid source values + source-specific required columns.
ALTER TABLE public.question_attempt_log
    DROP CONSTRAINT IF EXISTS question_attempt_log_source_type_check;

ALTER TABLE public.question_attempt_log
    ADD CONSTRAINT question_attempt_log_source_type_check
    CHECK (source_type IN ('quiz', 'flashcard'));

ALTER TABLE public.question_attempt_log
    DROP CONSTRAINT IF EXISTS question_attempt_log_source_fields_check;

ALTER TABLE public.question_attempt_log
    ADD CONSTRAINT question_attempt_log_source_fields_check
    CHECK (
        (
            source_type = 'quiz'
            AND question_id IS NOT NULL
            AND quiz_id IS NOT NULL
            AND attempt_id IS NOT NULL
            AND flashcard_id IS NULL
        )
        OR
        (
            source_type = 'flashcard'
            AND flashcard_id IS NOT NULL
            AND question_id IS NULL
            AND quiz_id IS NULL
            AND attempt_id IS NULL
        )
    );

-- 5) Optional support indexes for source-specific reads.
CREATE INDEX IF NOT EXISTS idx_qal_source_type
    ON public.question_attempt_log(source_type);

CREATE INDEX IF NOT EXISTS idx_qal_flashcard_id
    ON public.question_attempt_log(flashcard_id);
