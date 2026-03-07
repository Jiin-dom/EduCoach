-- Study notes: one note per (document, user) pair.
-- Auto-save from the frontend upserts on conflict.

CREATE TABLE study_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX study_notes_doc_user ON study_notes(document_id, user_id);

ALTER TABLE study_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes" ON study_notes
    FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER update_study_notes_updated_at
    BEFORE UPDATE ON study_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
