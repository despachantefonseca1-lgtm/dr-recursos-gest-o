-- Add recurso_elaborado column to infracoes table
-- This tracks whether the resource/recurso has been elaborated (written/prepared)
-- before protocol step, allowing the user to visually identify which ones are done.
ALTER TABLE infracoes ADD COLUMN IF NOT EXISTS recurso_elaborado BOOLEAN DEFAULT FALSE;
