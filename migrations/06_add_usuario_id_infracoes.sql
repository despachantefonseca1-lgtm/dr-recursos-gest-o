-- Adiciona a coluna usuario_id na tabela infracoes para controle de atribuição de responsável
ALTER TABLE infracoes
ADD COLUMN usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
