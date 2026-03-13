
-- 1. Companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Minha Empresa',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Add user_id and company_id to evaluations (nullable for backward compat)
ALTER TABLE public.evaluations
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- 4. Security definer helper to get company_id for current user
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 5. Trigger: auto-create company + profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
BEGIN
  INSERT INTO public.companies (name) VALUES ('Minha Empresa') RETURNING id INTO new_company_id;
  INSERT INTO public.profiles (id, company_id, full_name)
  VALUES (NEW.id, new_company_id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. RLS policies for companies
CREATE POLICY "Users can read own company" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.get_my_company_id());

-- 7. RLS policies for profiles
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 8. Drop old open RLS policies on evaluations
DROP POLICY IF EXISTS "Allow public read on evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Allow public insert on evaluations" ON public.evaluations;

-- 9. New RLS policies on evaluations scoped by company
CREATE POLICY "Authenticated read evaluations by company" ON public.evaluations
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id() OR company_id IS NULL);

CREATE POLICY "Authenticated insert evaluations" ON public.evaluations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.get_my_company_id());
