-- ============================================================
-- Migration 17: Correção de Permissões de RLS e Vinculação dos Dados da Matriz
-- Description: Desabilita RLS na tabela de unidades para permitir leitura pelo sistema,
-- garante as permissões e atualiza todas as infrações, tarefas e caixas
-- que estavam sem unidade_id para o ID da Matriz de Bom Despacho.
-- ============================================================

-- 1. DESABILITAR RLS NA TABELA UNIDADES E CONCEDER ACESSO
ALTER TABLE IF EXISTS unidades DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE unidades TO anon, authenticated, service_role;

-- 2. GARANTIR QUE A MATRIZ E NOVA SERRANA EXISTAM COM is_matriz = true
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
ON CONFLICT (slug) DO UPDATE 
SET is_matriz = EXCLUDED.is_matriz, 
    ativo = true;

-- 3. ATUALIZAR TODOS OS DADOS EXISTENTES PARA O ID DA MATRIZ
DO $$
DECLARE
    matriz_uuid UUID;
BEGIN
    SELECT id INTO matriz_uuid FROM unidades WHERE is_matriz = true LIMIT 1;
    
    IF matriz_uuid IS NOT NULL THEN
        -- Infrações
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'infracoes') THEN
            UPDATE infracoes SET unidade_id = matriz_uuid WHERE unidade_id IS NULL;
        END IF;

        -- Tarefas
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tarefas') THEN
            UPDATE tarefas SET unidade_id = matriz_uuid WHERE unidade_id IS NULL;
        END IF;

        -- Despachante Serviços
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'despachante_servicos') THEN
            UPDATE despachante_servicos SET unidade_id = matriz_uuid WHERE unidade_id IS NULL;
        END IF;

        -- Despachante Caixa
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'despachante_caixa') THEN
            UPDATE despachante_caixa SET unidade_id = matriz_uuid WHERE unidade_id IS NULL;
        END IF;

        -- Recursos Serviços
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recursos_servicos') THEN
            UPDATE recursos_servicos SET unidade_id = matriz_uuid WHERE unidade_id IS NULL;
        END IF;

        -- Perfis (Usuários)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
            UPDATE profiles SET unidade_id = matriz_uuid WHERE unidade_id IS NULL;
        END IF;

        -- Contratos
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contratos_clientes') THEN
            UPDATE contratos_clientes SET unidade_id = matriz_uuid WHERE unidade_id IS NULL;
        END IF;

        -- Recibos
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recibos_clientes') THEN
            UPDATE recibos_clientes SET unidade_id = matriz_uuid WHERE unidade_id IS NULL;
        END IF;

        -- Notas Promissórias
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notas_promissorias') THEN
            UPDATE notas_promissorias SET unidade_id = matriz_uuid WHERE unidade_id IS NULL;
        END IF;
    END IF;
END $$;
