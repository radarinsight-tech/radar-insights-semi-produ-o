
-- Promote first user to admin if no admin exists (fixes current test env)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT p.id, 'admin'::app_role
    FROM public.profiles p
    ORDER BY p.created_at ASC
    LIMIT 1
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Update handle_new_user to auto-assign admin role to first user in fresh projects
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  banda_turbo_id uuid;
  admin_exists boolean;
BEGIN
  SELECT id INTO banda_turbo_id FROM public.companies WHERE name = 'Banda Turbo' LIMIT 1;
  IF banda_turbo_id IS NULL THEN
    INSERT INTO public.companies (name) VALUES ('Banda Turbo') RETURNING id INTO banda_turbo_id;
  END IF;

  INSERT INTO public.profiles (id, company_id, full_name)
  VALUES (NEW.id, banda_turbo_id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO admin_exists;
  IF NOT admin_exists THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
