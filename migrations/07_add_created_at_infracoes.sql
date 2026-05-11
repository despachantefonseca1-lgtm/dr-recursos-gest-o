-- Adiciona a coluna created_at na tabela infracoes para o relatório de desempenho conseguir filtrar por data
ALTER TABLE infracoes
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
