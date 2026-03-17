CREATE TABLE public.preventive_mentorings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  atendente text,
  protocolo text,
  data_atendimento text,
  tipo text,
  cliente text,
  nota_interna numeric,
  classificacao_interna text,
  pontos_obtidos numeric DEFAULT 0,
  pontos_possiveis numeric DEFAULT 0,
  resultado jsonb,
  pontos_melhoria text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendente',
  error_message text,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preventive_mentorings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own preventive mentorings"
ON public.preventive_mentorings FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own preventive mentorings"
ON public.preventive_mentorings FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own preventive mentorings"
ON public.preventive_mentorings FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());