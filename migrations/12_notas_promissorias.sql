-- Migration: Notas Promissórias
-- Description: Cria as tabelas necessárias para o módulo de notas promissórias
-- Execute este script no Supabase SQL Editor

-- ============================================================
-- TABELA: notas_promissorias
-- Cabeçalho de cada negociação (1 negociação = N parcelas/notas)
-- ============================================================
CREATE TABLE IF NOT EXISTS notas_promissorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Vínculos
    cliente_id UUID REFERENCES recursos_clientes(id) ON DELETE CASCADE,

    -- Dados do devedor (snapshot editável no momento da emissão)
    devedor_nome TEXT NOT NULL,
    devedor_cpf_cnpj TEXT NOT NULL,
    devedor_endereco TEXT,
    devedor_logradouro TEXT,
    devedor_numero TEXT,
    devedor_bairro TEXT,
    devedor_cidade TEXT,
    devedor_uf TEXT,
    devedor_cep TEXT,
    devedor_telefone TEXT,

    -- Dados do credor (snapshot editável no momento da emissão)
    credor_nome TEXT NOT NULL DEFAULT 'Israel Fonseca',
    credor_cpf_cnpj TEXT NOT NULL DEFAULT '073.719.596-71',
    credor_endereco TEXT DEFAULT 'Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002',

    -- Dados da negociação
    descricao TEXT NOT NULL,
    valor_total NUMERIC(12,2) NOT NULL,
    num_parcelas INTEGER NOT NULL DEFAULT 1,
    data_emissao DATE NOT NULL,
    local_pagamento TEXT DEFAULT 'Bom Despacho/MG',
    periodicidade TEXT NOT NULL DEFAULT 'MENSAL', -- MENSAL, QUINZENAL, SEMANAL, PERSONALIZADA
    observacoes_internas TEXT,

    -- Avalistas (armazenado como JSON array)
    avalistas JSONB DEFAULT '[]'::jsonb,

    -- Situação geral
    situacao TEXT NOT NULL DEFAULT 'ATIVA', -- ATIVA, CANCELADA, QUITADA

    -- Auditoria de cancelamento
    motivo_cancelamento TEXT,
    cancelado_por TEXT,
    cancelado_em TIMESTAMPTZ,

    -- Auditoria de criação/atualização
    criado_por TEXT,
    atualizado_por TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: notas_parcelas
-- Cada parcela individual de uma negociação
-- ============================================================
CREATE TABLE IF NOT EXISTS notas_parcelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Vínculos
    nota_id UUID NOT NULL REFERENCES notas_promissorias(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES recursos_clientes(id) ON DELETE CASCADE,

    -- Identificação da parcela
    numero_parcela INTEGER NOT NULL,
    total_parcelas INTEGER NOT NULL,

    -- Dados financeiros
    data_vencimento DATE NOT NULL,
    valor NUMERIC(12,2) NOT NULL,

    -- Situação
    situacao TEXT NOT NULL DEFAULT 'A_VENCER',
    -- A_VENCER, VENCIDA, PAGA, PARCIALMENTE_PAGA, RENEGOCIADA, CANCELADA

    -- Registro de pagamento
    valor_pago NUMERIC(12,2) DEFAULT 0,
    data_pagamento DATE,
    forma_pagamento TEXT,
    obs_pagamento TEXT,
    comprovante_url TEXT,
    pago_por TEXT, -- nome/id do usuário que registrou

    -- Auditoria de PDF
    pdf_gerado_em TIMESTAMPTZ,
    pdf_gerado_por TEXT,

    -- Auditoria
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notas_promissorias_cliente ON notas_promissorias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notas_promissorias_situacao ON notas_promissorias(situacao);
CREATE INDEX IF NOT EXISTS idx_notas_parcelas_nota ON notas_parcelas(nota_id);
CREATE INDEX IF NOT EXISTS idx_notas_parcelas_cliente ON notas_parcelas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notas_parcelas_situacao ON notas_parcelas(situacao);
CREATE INDEX IF NOT EXISTS idx_notas_parcelas_vencimento ON notas_parcelas(data_vencimento);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Usuários autenticados podem ler/escrever suas próprias notas
-- ============================================================
ALTER TABLE notas_promissorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_parcelas ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados têm acesso total
CREATE POLICY "Authenticated users can manage notas_promissorias"
    ON notas_promissorias
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage notas_parcelas"
    ON notas_parcelas
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- FUNÇÃO: Atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notas_promissorias_updated_at
    BEFORE UPDATE ON notas_promissorias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER notas_parcelas_updated_at
    BEFORE UPDATE ON notas_parcelas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE notas_promissorias IS 'Cabeçalho de cada negociação de nota promissória';
COMMENT ON TABLE notas_parcelas IS 'Parcelas individuais de cada negociação';
COMMENT ON COLUMN notas_promissorias.avalistas IS 'Array JSON com dados dos avalistas: [{nome, cpf_cnpj, endereco, telefone, estado_civil, profissao}]';
COMMENT ON COLUMN notas_promissorias.periodicidade IS 'MENSAL | QUINZENAL | SEMANAL | PERSONALIZADA';
COMMENT ON COLUMN notas_promissorias.situacao IS 'ATIVA | CANCELADA | QUITADA';
COMMENT ON COLUMN notas_parcelas.situacao IS 'A_VENCER | VENCIDA | PAGA | PARCIALMENTE_PAGA | RENEGOCIADA | CANCELADA';
