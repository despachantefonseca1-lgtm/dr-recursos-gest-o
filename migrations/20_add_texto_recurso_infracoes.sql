-- ============================================================
-- Migration 20: Adição da coluna texto_recurso na tabela infracoes
-- Description: Permite armazenar a minuta personalizada do recurso
-- diretamente na infração, possibilitando edições, salvamento e exportação em PDF.
-- ============================================================

ALTER TABLE IF EXISTS infracoes 
ADD COLUMN IF NOT EXISTS texto_recurso TEXT;

-- Comentário da coluna
COMMENT ON COLUMN infracoes.texto_recurso IS 'Texto redigido e editado do recurso da infração';
