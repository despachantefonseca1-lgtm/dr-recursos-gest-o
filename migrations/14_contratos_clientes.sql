-- Migration: Contratos de Prestação de Serviços Advocatícios
-- Description: Cria a tabela para armazenar os contratos gerados para clientes de recursos de multas, com suporte a versionamento e snapshot dos dados.
-- Execute este script no Supabase SQL Editor se desejar persistência em banco.

CREATE TABLE IF NOT EXISTS contratos_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES recursos_clientes(id) ON DELETE CASCADE,
    versao INTEGER NOT NULL DEFAULT 1,
    titulo TEXT NOT NULL, -- ex: 'Contrato v1'
    conteudo_texto TEXT NOT NULL,
    dados_snapshot JSONB NOT NULL,
    criado_por TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca rápida por cliente e versão
CREATE INDEX IF NOT EXISTS idx_contratos_clientes_cliente_id ON contratos_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_clientes_created_at ON contratos_clientes(created_at DESC);
