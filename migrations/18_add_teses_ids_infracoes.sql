-- ============================================================
-- Migration 18: Adição da coluna teses_ids na tabela infracoes
-- Description: Permite persistir os IDs das teses jurídicas selecionadas
-- para cada infração/recurso, mantendo-as salvas entre sessões.
-- ============================================================

ALTER TABLE IF EXISTS infracoes 
ADD COLUMN IF NOT EXISTS teses_ids JSONB DEFAULT '[]'::jsonb;

-- Comentário da coluna
COMMENT ON COLUMN infracoes.teses_ids IS 'Array JSON contendo os IDs das teses jurídicas selecionadas para esta infração';
