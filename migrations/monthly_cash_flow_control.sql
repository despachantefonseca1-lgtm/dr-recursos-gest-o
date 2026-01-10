-- Migration: Add monthly cash flow control
-- Description: Adds fields to track which month a service belongs to and whether that month is closed

-- Add columns to recursos_servicos
ALTER TABLE recursos_servicos 
ADD COLUMN IF NOT EXISTS mes_referencia TEXT,
ADD COLUMN IF NOT EXISTS caixa_fechado BOOLEAN DEFAULT FALSE;

-- Add columns to despachante_servicos
ALTER TABLE despachante_servicos 
ADD COLUMN IF NOT EXISTS mes_referencia TEXT,
ADD COLUMN IF NOT EXISTS caixa_fechado BOOLEAN DEFAULT FALSE;

-- Update existing records to have mes_referencia based on data_contratacao or data_servico
UPDATE recursos_servicos 
SET mes_referencia = TO_CHAR(data_contratacao::date, 'YYYY-MM')
WHERE data_contratacao IS NOT NULL AND mes_referencia IS NULL;

UPDATE despachante_servicos 
SET mes_referencia = TO_CHAR(data_servico::date, 'YYYY-MM')
WHERE data_servico IS NOT NULL AND mes_referencia IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recursos_servicos_mes ON recursos_servicos(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_despachante_servicos_mes ON despachante_servicos(mes_referencia);

-- Add comment to document the feature
COMMENT ON COLUMN recursos_servicos.mes_referencia IS 'Month reference in YYYY-MM format for cash flow control';
COMMENT ON COLUMN recursos_servicos.caixa_fechado IS 'Whether this months cash flow is closed (no more edits allowed)';
COMMENT ON COLUMN despachante_servicos.mes_referencia IS 'Month reference in YYYY-MM format for cash flow control';
COMMENT ON COLUMN despachante_servicos.caixa_fechado IS 'Whether this months cash flow is closed (no more edits allowed)';
