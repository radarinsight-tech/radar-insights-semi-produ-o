CREATE TABLE IF NOT EXISTS public.attendant_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  attendant_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  excluded BOOLEAN NOT NULL DEFAULT true,
  excluded_at TIMESTAMPTZ,
  excluded_by TEXT,
  origin TEXT NOT NULL DEFAULT 'painel_bonus',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendant_exclusions_company_normalized_unique UNIQUE (company_id, normalized_name)
);

ALTER TABLE public.attendant_exclusions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attendant_exclusions_company_excluded
  ON public.attendant_exclusions (company_id, excluded);

CREATE INDEX IF NOT EXISTS idx_attendant_exclusions_company_normalized
  ON public.attendant_exclusions (company_id, normalized_name);

DROP POLICY IF EXISTS "Users can read exclusions from own company" ON public.attendant_exclusions;
CREATE POLICY "Users can read exclusions from own company"
ON public.attendant_exclusions
FOR SELECT
TO authenticated
USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Users can insert exclusions in own company" ON public.attendant_exclusions;
CREATE POLICY "Users can insert exclusions in own company"
ON public.attendant_exclusions
FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Users can update exclusions in own company" ON public.attendant_exclusions;
CREATE POLICY "Users can update exclusions in own company"
ON public.attendant_exclusions
FOR UPDATE
TO authenticated
USING (company_id = public.get_my_company_id())
WITH CHECK (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Users can delete exclusions from own company" ON public.attendant_exclusions;
CREATE POLICY "Users can delete exclusions from own company"
ON public.attendant_exclusions
FOR DELETE
TO authenticated
USING (company_id = public.get_my_company_id());

DROP TRIGGER IF EXISTS update_attendant_exclusions_updated_at ON public.attendant_exclusions;
CREATE TRIGGER update_attendant_exclusions_updated_at
BEFORE UPDATE ON public.attendant_exclusions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();