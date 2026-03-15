
ALTER TABLE public.credit_analyses
ADD COLUMN IF NOT EXISTS ajuste_manual boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS faixa_original text,
ADD COLUMN IF NOT EXISTS motivo_ajuste text,
ADD COLUMN IF NOT EXISTS observacao_ajuste text,
ADD COLUMN IF NOT EXISTS usuario_ajuste text,
ADD COLUMN IF NOT EXISTS data_ajuste timestamptz;

-- Allow users to update their own credit analyses (for manual adjustments)
CREATE POLICY "Authenticated update own credit analyses"
ON public.credit_analyses
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
