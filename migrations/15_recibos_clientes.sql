-- Migration: Recibos de Pagamento de Honorários Advocatícios
-- Description: Cria a tabela para armazenar os recibos emitidos para clientes de recursos de multas com assinatura digitalizada de Israel Fonseca e vinculação às infrações quitadas.
-- Execute este script no Supabase SQL Editor se desejar persistência no banco de dados.

CREATE TABLE IF NOT EXISTS recibos_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES recursos_clientes(id) ON DELETE CASCADE,
    servico_id UUID REFERENCES recursos_servicos(id) ON DELETE SET NULL,
    numero_recibo TEXT NOT NULL, -- ex: 'REC-2026-0001'
    valor NUMERIC(12, 2) NOT NULL,
    valor_extenso TEXT NOT NULL,
    data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
    cidade_emissao TEXT NOT NULL DEFAULT 'Bom Despacho/MG',
    infracoes_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    infracoes_resumo JSONB NOT NULL DEFAULT '[]'::jsonb,
    conteudo_texto TEXT NOT NULL,
    criado_por TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas otimizadas
CREATE INDEX IF NOT EXISTS idx_recibos_clientes_cliente_id ON recibos_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_recibos_clientes_created_at ON recibos_clientes(created_at DESC);
