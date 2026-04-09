-- Migração para corrigir políticas RLS após reprovação do scan do Lovable
-- Esta migração altera as políticas de SELECT para usar company_id ao invés de USING: true
-- Também configura o bucket credit-documents como privado

-- Habilitar RLS nas tabelas se ainda não estiver habilitado
ALTER TABLE public.credit_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes que usam USING: true
DROP POLICY IF EXISTS "Allow all select on credit_analyses" ON public.credit_analyses;
DROP POLICY IF EXISTS "Allow all select on document_analyses" ON public.document_analyses;

-- Criar novas políticas de SELECT filtrando por company_id
CREATE POLICY "Users can view their company's credit analyses" ON public.credit_analyses
FOR SELECT USING (
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can view their company's document analyses" ON public.document_analyses
FOR SELECT USING (
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

-- Configurar bucket credit-documents como privado
-- Habilitar RLS no storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remover política pública existente se houver
DROP POLICY IF EXISTS "Allow public access to credit-documents" ON storage.objects;

-- Criar política para acesso restrito ao bucket credit-documents
-- Assume que os arquivos estão organizados em pastas por company_id (ex: company_id/filename)
CREATE POLICY "Users can access their company's documents in credit-documents" ON storage.objects
FOR ALL USING (
  bucket_id = 'credit-documents' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
);

-- Política adicional para INSERT/UPDATE/DELETE se necessário
CREATE POLICY "Users can manage their company's documents in credit-documents" ON storage.objects
FOR ALL USING (
  bucket_id = 'credit-documents' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
);