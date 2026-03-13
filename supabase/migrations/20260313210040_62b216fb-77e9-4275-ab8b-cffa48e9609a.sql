
CREATE TABLE public.evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data TEXT NOT NULL,
  protocolo TEXT NOT NULL,
  atendente TEXT NOT NULL,
  tipo TEXT NOT NULL,
  atualizacao_cadastral TEXT NOT NULL DEFAULT 'Não',
  nota NUMERIC(3,1) NOT NULL,
  classificacao TEXT NOT NULL,
  bonus BOOLEAN NOT NULL DEFAULT false,
  pontos_melhoria TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on evaluations"
  ON public.evaluations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on evaluations"
  ON public.evaluations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
