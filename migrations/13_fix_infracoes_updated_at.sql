-- Migration: Fix infracoes updated_at column and trigger
-- Description: Adiciona a coluna updated_at na tabela infracoes e configura a trigger de atualização automática.
-- Execute este script no Supabase SQL Editor para corrigir o erro: record "new" has no field "updated_at"

-- 1. Adicionar a coluna updated_at na tabela infracoes (caso não exista)
ALTER TABLE infracoes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Garantir que a função de atualização exista
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar a trigger para a tabela infracoes
DROP TRIGGER IF EXISTS infracoes_updated_at ON infracoes;
DROP TRIGGER IF EXISTS update_infracoes_updated_at ON infracoes;

CREATE TRIGGER infracoes_updated_at
    BEFORE UPDATE ON infracoes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
