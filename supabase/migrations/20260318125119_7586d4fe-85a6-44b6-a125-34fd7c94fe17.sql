CREATE TABLE public.monthly_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  status text NOT NULL DEFAULT 'aberto',
  total_mentorias integer NOT NULL DEFAULT 0,
  nota_media numeric NOT NULL DEFAULT 0,
  total_bonus numeric NOT NULL DEFAULT 0,
  snapshot jsonb DEFAULT '[]'::jsonb,
  closed_by text DEFAULT NULL,
  closed_at timestamp with time zone DEFAULT NULL,
  reopened_by text DEFAULT NULL,
  reopened_at timestamp with time zone DEFAULT NULL,
  company_id uuid REFERENCES public.companies(id) DEFAULT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (year, month, company_id)
);

ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own monthly closings"
  ON public.monthly_closings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own monthly closings"
  ON public.monthly_closings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own monthly closings"
  ON public.monthly_closings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));