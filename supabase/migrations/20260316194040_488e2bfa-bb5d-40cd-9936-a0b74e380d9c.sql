
-- Add 'auditoria' and 'credito' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditoria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'credito';
