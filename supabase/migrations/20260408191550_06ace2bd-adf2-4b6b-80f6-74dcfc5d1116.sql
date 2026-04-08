
-- Add missing UPDATE and DELETE policies for pdfs bucket
CREATE POLICY "Users can update own pdfs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pdfs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Users can delete own pdfs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pdfs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);
