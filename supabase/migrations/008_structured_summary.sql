-- Add structured_summary JSONB column to documents table
-- Stores the three-format summary (short, detailed sections, bullets)
-- while keeping the plain text 'summary' column for backward compatibility.

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS structured_summary JSONB DEFAULT NULL;

COMMENT ON COLUMN documents.structured_summary IS
'JSON with keys: short (string), detailed (array of {title, icon, content, pages?}), bullets (array of {label, text, page?})';
