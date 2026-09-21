-- Migration 19: Permissões de Acesso e Ajuste de RLS na tabela profiles

-- 1. Desabilita RLS na tabela profiles para que o Administrador consiga criar novos usuários e gerenciar permissões de qualquer usuário
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE profiles TO anon, authenticated, service_role;

-- 2. Garante a coluna de permissões (em português e inglês para compatibilidade total)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN profiles.permissoes IS 'Permissões granulares de acesso por módulo do sistema (caixa, despachante, recursos, etc.)';
