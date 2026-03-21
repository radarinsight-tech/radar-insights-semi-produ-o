
-- Allow admins to delete mentoria_batch_files
CREATE POLICY "Admins can delete batch files"
ON public.mentoria_batch_files
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete mentoria_batches
CREATE POLICY "Admins can delete batches"
ON public.mentoria_batches
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
