-- Migration: Adicionar suporte a imagens nas tarefas
-- Execute este SQL no Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Adicionar coluna imagem_url na tabela tarefas
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- 2. Criar bucket de storage para imagens de tarefas
INSERT INTO storage.buckets (id, name, public)
VALUES ('tarefa-imagens', 'tarefa-imagens', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Política de acesso: qualquer usuário autenticado pode fazer upload
CREATE POLICY "Authenticated users can upload task images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tarefa-imagens');

-- 4. Política de acesso: qualquer pessoa pode visualizar (público)
CREATE POLICY "Public can view task images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tarefa-imagens');

-- 5. Política de acesso: qualquer usuário autenticado pode deletar
CREATE POLICY "Authenticated users can delete task images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'tarefa-imagens');
