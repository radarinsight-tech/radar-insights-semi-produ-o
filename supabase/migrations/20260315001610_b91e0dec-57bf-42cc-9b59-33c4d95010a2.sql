
ALTER TABLE public.credit_analyses
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'CPF',
  ADD COLUMN IF NOT EXISTS regra_aplicada text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'nova_consulta',
  ADD COLUMN IF NOT EXISTS user_name text;

CREATE POLICY "Admins can delete credit analyses"
  ON public.credit_analyses FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
