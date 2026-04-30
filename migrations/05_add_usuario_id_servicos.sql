-- Add usuario_id column to track who created the service
ALTER TABLE despachante_servicos ADD COLUMN IF NOT EXISTS usuario_id UUID;
