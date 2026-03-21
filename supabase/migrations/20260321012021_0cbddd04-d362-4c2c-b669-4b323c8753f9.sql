
-- 1. Create sectors table
CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, company_id)
);

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read sectors from own company"
  ON public.sectors FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "Admins can insert sectors"
  ON public.sectors FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND company_id = get_my_company_id());

CREATE POLICY "Admins can update sectors"
  ON public.sectors FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') AND company_id = get_my_company_id());

CREATE POLICY "Admins can delete sectors"
  ON public.sectors FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 2. Create user_sectors junction table
CREATE TABLE public.user_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, sector_id)
);

ALTER TABLE public.user_sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sectors"
  ON public.user_sectors FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all user_sectors"
  ON public.user_sectors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user_sectors"
  ON public.user_sectors FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user_sectors"
  ON public.user_sectors FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 3. Add sector_id to evaluations (nullable for legacy data)
ALTER TABLE public.evaluations ADD COLUMN sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL;

-- 4. Add sector_id to credit_analyses (nullable for legacy data)
ALTER TABLE public.credit_analyses ADD COLUMN sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL;

-- 5. Security definer function to get user's sector IDs
CREATE OR REPLACE FUNCTION public.get_my_sector_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sector_id FROM public.user_sectors WHERE user_id = auth.uid()
$$;

-- 6. Migrate existing attendants.sector values into sectors table
-- (will run for each unique sector text per company)
INSERT INTO public.sectors (name, company_id)
SELECT DISTINCT a.sector, a.company_id
FROM public.attendants a
WHERE a.sector IS NOT NULL AND a.sector != ''
ON CONFLICT (name, company_id) DO NOTHING;
