-- ============================================================
-- Migration 16: Módulo Multi-Unidade (Filiais e Matriz)
-- Description: Cria a tabela de unidades, cadastra a Matriz (Bom Despacho) e Nova Serrana,
-- garante a existência das tabelas de apoio (contratos, recibos, notas promissórias),
-- adiciona a coluna unidade_id com segurança e vincula retroativamente os dados existentes.
-- ============================================================

-- 1. TABELA DE UNIDADES
CREATE TABLE IF NOT EXISTS unidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,                          -- ex: 'Matriz - Bom Despacho' ou 'Unidade Nova Serrana'
    slug TEXT UNIQUE NOT NULL,                  -- ex: 'matriz-bd', 'nova-serrana'
    cidade TEXT NOT NULL,                        -- ex: 'Bom Despacho', 'Nova Serrana'
    uf TEXT NOT NULL DEFAULT 'MG',
    endereco_completo TEXT NOT NULL,            -- ex: 'Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002'
    telefone TEXT,
    email TEXT,
    cidade_emissao TEXT NOT NULL,               -- ex: 'Bom Despacho/MG' ou 'Nova Serrana/MG'
    local_pagamento_padrao TEXT NOT NULL,       -- ex: 'Bom Despacho/MG' ou 'Nova Serrana/MG'
    
    -- Dados de qualificação do responsável/advogado para documentos
    advogado_nome TEXT DEFAULT 'Israel Fonseca',
    advogado_oab_numero TEXT DEFAULT '214.437',
    advogado_oab_uf TEXT DEFAULT 'MG',
    advogado_cpf TEXT DEFAULT '073.719.596-71',
    advogado_qualificacao TEXT DEFAULT 'Israel Fonseca, brasileiro, casado, advogado, inscrito na OAB/MG sob n° 214.437, com escritório profissional na Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002, endereço eletrônico ifadvogado214437@gmail.com',
    
    is_matriz BOOLEAN NOT NULL DEFAULT false,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CADASTRO INICIAL DA MATRIZ E DA UNIDADE NOVA SERRANA
INSERT INTO unidades (
    nome, slug, cidade, uf, endereco_completo, telefone, email, cidade_emissao, local_pagamento_padrao,
    advogado_nome, advogado_oab_numero, advogado_oab_uf, advogado_cpf, advogado_qualificacao, is_matriz, ativo
)
VALUES 
(
    'Matriz - Bom Despacho',
    'matriz-bd',
    'Bom Despacho',
    'MG',
    'Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002',
    '(37) 99999-9999',
    'ifadvogado214437@gmail.com',
    'Bom Despacho/MG',
    'Bom Despacho/MG',
    'Israel Fonseca',
    '214.437',
    'MG',
    '073.719.596-71',
    'Israel Fonseca, brasileiro, casado, advogado, inscrito na OAB/MG sob n° 214.437, com escritório profissional na Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002, endereço eletrônico ifadvogado214437@gmail.com',
    true,
    true
),
(
    'Unidade Nova Serrana',
    'nova-serrana',
    'Nova Serrana',
    'MG',
    'Centro, Nova Serrana/MG',
    '(37) 99999-9999',
    'ifadvogado214437@gmail.com',
    'Nova Serrana/MG',
    'Nova Serrana/MG',
    'Israel Fonseca',
    '214.437',
    'MG',
    '073.719.596-71',
    'Israel Fonseca, brasileiro, casado, advogado, inscrito na OAB/MG sob n° 214.437, com escritório profissional no Centro, Nova Serrana/MG, endereço eletrônico ifadvogado214437@gmail.com',
    false,
    true
)
ON CONFLICT (slug) DO NOTHING;

-- 3. GARANTIR TABELAS DE APOIO (SE NÃO EXISTIREM)
CREATE TABLE IF NOT EXISTS contratos_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID,
    versao INTEGER NOT NULL DEFAULT 1,
    titulo TEXT NOT NULL,
    conteudo_texto TEXT NOT NULL,
    dados_snapshot JSONB NOT NULL,
    criado_por TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recibos_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID,
    servico_id UUID,
    numero_recibo TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS notas_promissorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID,
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
    credor_nome TEXT NOT NULL DEFAULT 'Israel Fonseca',
    credor_cpf_cnpj TEXT NOT NULL DEFAULT '073.719.596-71',
    credor_endereco TEXT DEFAULT 'Avenida das Palmeiras, nº 512, Centro, Bom Despacho/MG, CEP 35630-002',
    descricao TEXT NOT NULL,
    valor_total NUMERIC(12,2) NOT NULL,
    num_parcelas INTEGER NOT NULL DEFAULT 1,
    data_emissao DATE NOT NULL,
    local_pagamento TEXT DEFAULT 'Bom Despacho/MG',
    periodicidade TEXT NOT NULL DEFAULT 'MENSAL',
    observacoes_internas TEXT,
    avalistas JSONB DEFAULT '[]'::jsonb,
    situacao TEXT NOT NULL DEFAULT 'ATIVA',
    motivo_cancelamento TEXT,
    cancelado_por TEXT,
    cancelado_em TIMESTAMPTZ,
    criado_por TEXT,
    atualizado_por TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ADIÇÃO SEGURA DA COLUNA unidade_id NAS TABELAS DO SISTEMA
DO $$
DECLARE
    matriz_id UUID;
    tbl TEXT;
    tabelas_alvo TEXT[] := ARRAY[
        'profiles',
        'infracoes',
        'despachante_servicos',
        'despachante_caixa',
        'recursos_servicos',
        'notas_promissorias',
        'contratos_clientes',
        'recibos_clientes',
        'tarefas'
    ];
BEGIN
    SELECT id INTO matriz_id FROM unidades WHERE is_matriz = true LIMIT 1;

    FOREACH tbl IN ARRAY tabelas_alvo LOOP
        -- Verifica se a tabela existe antes de alterar
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            -- Adiciona a coluna unidade_id se não existir
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES unidades(id) ON DELETE SET NULL', tbl);

            -- Vincula retroativamente os registros existentes à Matriz
            IF matriz_id IS NOT NULL THEN
                EXECUTE format('UPDATE %I SET unidade_id = %L WHERE unidade_id IS NULL', tbl, matriz_id);
            END IF;

            -- Cria o índice de performance com segurança
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(unidade_id)', 'idx_' || tbl || '_unidade_id', tbl);
        END IF;
    END LOOP;
END $$;
