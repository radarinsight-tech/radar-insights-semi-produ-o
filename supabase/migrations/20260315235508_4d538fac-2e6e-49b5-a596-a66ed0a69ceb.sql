
-- Fix document_items INSERT policy: link to analysis owner
DROP POLICY IF EXISTS "Authenticated insert document items" ON public.document_items;
CREATE POLICY "Authenticated insert document items"
ON public.document_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.document_analyses da
    WHERE da.id = document_analysis_id
    AND (da.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Fix document_items UPDATE policy
DROP POLICY IF EXISTS "Authenticated update document items" ON public.document_items;
CREATE POLICY "Authenticated update document items"
ON public.document_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.document_analyses da
    WHERE da.id = document_analysis_id
    AND (da.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.document_analyses da
    WHERE da.id = document_analysis_id
    AND (da.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);
