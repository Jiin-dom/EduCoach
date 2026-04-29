-- Add an optional source clue for generated quiz questions.
-- Nullable for backward compatibility with existing quiz rows.

ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS question_context TEXT;

COMMENT ON COLUMN public.quiz_questions.question_context IS
'Optional source clue or excerpt shown with a quiz question when the prompt needs context.';
