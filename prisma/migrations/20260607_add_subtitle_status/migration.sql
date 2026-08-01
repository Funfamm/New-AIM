-- Add approval status to subtitles (draft | approved_source)
ALTER TABLE subtitles ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft';
