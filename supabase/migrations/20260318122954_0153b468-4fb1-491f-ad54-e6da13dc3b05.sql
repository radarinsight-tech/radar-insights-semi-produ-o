
CREATE TABLE public.attendants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sector text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: no duplicate names per company
ALTER TABLE public.attendants ADD CONSTRAINT attendants_name_company_unique UNIQUE (company_id, name);

-- RLS
ALTER TABLE public.attendants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read attendants from own company"
ON public.attendants FOR SELECT TO authenticated
USING (company_id = get_my_company_id());

CREATE POLICY "Users can insert attendants in own company"
ON public.attendants FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Users can update attendants in own company"
ON public.attendants FOR UPDATE TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Admins can delete attendants"
ON public.attendants FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_attendants_updated_at
  BEFORE UPDATE ON public.attendants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
