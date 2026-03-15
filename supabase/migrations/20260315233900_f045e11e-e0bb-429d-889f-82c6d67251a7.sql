
DROP POLICY IF EXISTS "Authenticated update own credit analyses" ON public.credit_analyses;

CREATE POLICY "Authenticated update own credit analyses"
ON public.credit_analyses
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
