-- Migration: Criar tabela de teses de recurso
-- Execute este SQL no Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS teses_recurso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  texto TEXT NOT NULL,
  categoria TEXT,
  fase_recursal TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE teses_recurso ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ler, criar, editar e excluir
CREATE POLICY "allow_authenticated_all" ON teses_recurso
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_teses_categoria ON teses_recurso(categoria);
CREATE INDEX IF NOT EXISTS idx_teses_ativo ON teses_recurso(ativo);
CREATE INDEX IF NOT EXISTS idx_teses_fase ON teses_recurso(fase_recursal);
