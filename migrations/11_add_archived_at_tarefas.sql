-- Migration: Add archived_at column to tarefas for soft-archive support
-- Run this in the Supabase SQL editor

ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Optional index for efficient filtering of non-archived tasks
CREATE INDEX IF NOT EXISTS idx_tarefas_archived_at ON tarefas (archived_at);
