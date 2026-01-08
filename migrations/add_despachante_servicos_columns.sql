-- Migration: Adicionar colunas faltantes em despachante_servicos
-- Execute este SQL no Supabase SQL Editor

-- Adicionar colunas que podem estar faltando
ALTER TABLE despachante_servicos
ADD COLUMN IF NOT EXISTS veiculo TEXT,
ADD COLUMN IF NOT EXISTS pagamento_obs TEXT,
ADD COLUMN IF NOT EXISTS melhor_horario_vistoria TEXT,
ADD COLUMN IF NOT EXISTS complementacao TEXT;

-- Verificar estrutura da tabela
-- Descomente a linha abaixo para ver todas as colunas
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'despachante_servicos';
