
CREATE TABLE public.credit_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id),
  cpf_cnpj text NOT NULL,
  nome text,
  decisao_final text,
  resultado jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read credit analyses"
  ON public.credit_analyses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert credit analyses"
  ON public.credit_analyses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_credit_analyses_cpf_cnpj ON public.credit_analyses(cpf_cnpj);
