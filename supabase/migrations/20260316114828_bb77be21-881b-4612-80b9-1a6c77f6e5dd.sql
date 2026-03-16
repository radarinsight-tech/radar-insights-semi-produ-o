
-- Add versioning and validation columns to evaluations
ALTER TABLE public.evaluations 
  ADD COLUMN IF NOT EXISTS prompt_version text NOT NULL DEFAULT 'auditor_v1',
  ADD COLUMN IF NOT EXISTS resultado_validado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS audit_log jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_evaluation_id uuid REFERENCES public.evaluations(id) DEFAULT NULL;

-- Update existing rows to mark as validated with legacy version
UPDATE public.evaluations SET prompt_version = 'auditor_v1', resultado_validado = true WHERE prompt_version = 'auditor_v1';
