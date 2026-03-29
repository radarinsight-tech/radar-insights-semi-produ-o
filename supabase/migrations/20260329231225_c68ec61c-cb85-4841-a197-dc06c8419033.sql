
-- Add mentoria_atendente to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mentoria_atendente';

-- Add attendant_id column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS attendant_id uuid REFERENCES public.attendants(id) ON DELETE SET NULL;
