
-- Create the trigger on auth.users to auto-create profiles
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Manually create profile for test user that was already created
INSERT INTO public.profiles (id, company_id, full_name, force_password_change)
SELECT 
  '1c4380b3-c372-4832-bdf6-18cf12e1b3e8',
  (SELECT id FROM public.companies WHERE name = 'Banda Turbo' LIMIT 1),
  'Usuário Teste',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE id = '1c4380b3-c372-4832-bdf6-18cf12e1b3e8'
);

-- Also create profiles for other users missing profiles
INSERT INTO public.profiles (id, company_id, full_name, force_password_change)
SELECT 
  u.id,
  (SELECT id FROM public.companies WHERE name = 'Banda Turbo' LIMIT 1),
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  false
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u.id);
