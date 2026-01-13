-- Adiciona campos de órgão emissor e UF do RG à tabela recursos_clientes
ALTER TABLE recursos_clientes 
ADD COLUMN IF NOT EXISTS rg_orgao_emissor TEXT,
ADD COLUMN IF NOT EXISTS rg_uf TEXT;

-- Define valores padrão para registros existentes (SSP MG)
UPDATE recursos_clientes 
SET rg_orgao_emissor = 'SSP',
    rg_uf = 'MG'
WHERE (rg_orgao_emissor IS NULL OR rg_orgao_emissor = '')
   AND (rg_uf IS NULL OR rg_uf = '')
   AND rg IS NOT NULL
   AND rg != '';
