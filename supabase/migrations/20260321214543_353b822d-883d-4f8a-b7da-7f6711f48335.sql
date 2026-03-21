
ALTER TABLE public.attendants
  ADD COLUMN empresa text DEFAULT NULL,
  ADD COLUMN departamento text DEFAULT NULL,
  ADD COLUMN base text DEFAULT 'matriz',
  ADD COLUMN participates_evaluation boolean NOT NULL DEFAULT true;
