-- Phase 6.4: Mastery Snapshots
-- Stores a historical record of mastery scores each time they are recomputed.
-- Powers the "Mastery Over Time" analytics chart.

CREATE TABLE IF NOT EXISTS mastery_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    mastery_score NUMERIC(5,2) NOT NULL,
    mastery_level TEXT NOT NULL CHECK (mastery_level IN ('needs_review', 'developing', 'mastered')),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mastery_snapshots_user_concept_time
    ON mastery_snapshots (user_id, concept_id, recorded_at DESC);

CREATE INDEX idx_mastery_snapshots_user_time
    ON mastery_snapshots (user_id, recorded_at DESC);

-- RLS
ALTER TABLE mastery_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mastery snapshots"
    ON mastery_snapshots FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mastery snapshots"
    ON mastery_snapshots FOR INSERT
    WITH CHECK (auth.uid() = user_id);
