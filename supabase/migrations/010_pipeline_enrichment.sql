-- Phase 3.8: Pipeline Enrichment & Study Intelligence
-- Adds processing_quality to documents, source_pages to concepts,
-- and creates the flashcards table for spaced-repetition study.

-- 1. Processing quality score (0.0 – 1.0) computed by NLP pipeline
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS processing_quality REAL;

-- 2. Source pages: which pages/slides a concept was extracted from
ALTER TABLE concepts
    ADD COLUMN IF NOT EXISTS source_pages INTEGER[];

-- 3. Flashcards table for spaced-repetition study
CREATE TABLE IF NOT EXISTS flashcards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    concept_id  UUID REFERENCES concepts(id) ON DELETE SET NULL,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    front       TEXT NOT NULL,
    back        TEXT NOT NULL,
    difficulty_level TEXT DEFAULT 'intermediate',
    source_page INTEGER,
    repetition  INTEGER DEFAULT 0,
    interval_days REAL DEFAULT 1,
    ease_factor REAL DEFAULT 2.5,
    due_date    TIMESTAMPTZ DEFAULT now(),
    last_reviewed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_document ON flashcards(document_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user     ON flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_due      ON flashcards(user_id, due_date);

-- RLS: users see only their own flashcards
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flashcards"
    ON flashcards FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flashcards"
    ON flashcards FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flashcards"
    ON flashcards FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flashcards"
    ON flashcards FOR DELETE
    USING (auth.uid() = user_id);

-- Service role bypass for edge functions
CREATE POLICY "Service role full access to flashcards"
    ON flashcards FOR ALL
    USING (auth.role() = 'service_role');
