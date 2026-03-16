
-- Add OCR, fraud detection and audit fields to document_items
ALTER TABLE public.document_items
  ADD COLUMN IF NOT EXISTS hash_arquivo text,
  ADD COLUMN IF NOT EXISTS texto_extraido text,
  ADD COLUMN IF NOT EXISTS confianca_ocr numeric,
  ADD COLUMN IF NOT EXISTS campos_extraidos jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS divergencias jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS alertas jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS risco_documental text DEFAULT 'baixo',
  ADD COLUMN IF NOT EXISTS suspeita_fraude boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_ocr text DEFAULT 'aguardando_leitura',
  ADD COLUMN IF NOT EXISTS status_documento text DEFAULT 'recebido',
  ADD COLUMN IF NOT EXISTS revisado_por text,
  ADD COLUMN IF NOT EXISTS data_revisao timestamp with time zone,
  ADD COLUMN IF NOT EXISTS motivo_exclusao text,
  ADD COLUMN IF NOT EXISTS excluido_por text,
  ADD COLUMN IF NOT EXISTS data_exclusao timestamp with time zone,
  ADD COLUMN IF NOT EXISTS data_emissao date,
  ADD COLUMN IF NOT EXISTS data_inicio_contrato date,
  ADD COLUMN IF NOT EXISTS data_fim_contrato date;
