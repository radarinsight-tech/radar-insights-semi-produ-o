
-- Drop existing restrictive RLS policies on evaluations
DROP POLICY IF EXISTS "Authenticated read evaluations by company" ON public.evaluations;
DROP POLICY IF EXISTS "Authenticated insert evaluations" ON public.evaluations;

-- New simple policies: any authenticated user can read all evaluations
CREATE POLICY "Authenticated read all evaluations" ON public.evaluations
  FOR SELECT TO authenticated
  USING (true);

-- Any authenticated user can insert (just needs user_id set)
CREATE POLICY "Authenticated insert evaluations" ON public.evaluations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update the trigger to assign all users to the same "Banda Turbo" company
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  banda_turbo_id uuid;
BEGIN
  -- Get or create the single company
  SELECT id INTO banda_turbo_id FROM public.companies WHERE name = 'Banda Turbo' LIMIT 1;
  IF banda_turbo_id IS NULL THEN
    INSERT INTO public.companies (name) VALUES ('Banda Turbo') RETURNING id INTO banda_turbo_id;
  END IF;

  INSERT INTO public.profiles (id, company_id, full_name)
  VALUES (NEW.id, banda_turbo_id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;
