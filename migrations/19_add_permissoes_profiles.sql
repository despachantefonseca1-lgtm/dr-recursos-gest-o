-- Migration: Adicionar coluna de permissões na tabela profiles
-- Permite que o Administrador Geral configure autorizações granulares por usuário
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN profiles.permissoes IS 'Permissões granulares de acesso por módulo do sistema (caixa, despachante, recursos, etc.)';
