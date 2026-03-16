
ALTER TABLE public.document_analyses
ADD COLUMN IF NOT EXISTS decisao_sugerida text,
ADD COLUMN IF NOT EXISTS motivo_sugestao text,
ADD COLUMN IF NOT EXISTS justificativa_divergencia text;
