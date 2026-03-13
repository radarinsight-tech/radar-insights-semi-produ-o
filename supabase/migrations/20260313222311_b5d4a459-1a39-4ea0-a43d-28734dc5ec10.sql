
-- Allow authenticated users to read all profiles (single company setup)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Authenticated read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);
