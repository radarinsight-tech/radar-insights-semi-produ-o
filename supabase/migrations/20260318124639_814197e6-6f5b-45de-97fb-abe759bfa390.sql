-- Add exclusion fields to evaluations
ALTER TABLE public.evaluations 
  ADD COLUMN excluded_from_ranking boolean NOT NULL DEFAULT false,
  ADD COLUMN exclusion_reason text DEFAULT NULL,
  ADD COLUMN excluded_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN excluded_by text DEFAULT NULL;

-- Allow authenticated users to update their own evaluations (for exclusion)
CREATE POLICY "Users can update own evaluations"
  ON public.evaluations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));