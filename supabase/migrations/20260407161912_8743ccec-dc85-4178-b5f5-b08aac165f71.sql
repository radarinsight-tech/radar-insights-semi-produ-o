
-- 1. Fix document_items SELECT: restrict to ownership via document_analyses join
DROP POLICY "Authenticated read document items" ON document_items;
CREATE POLICY "Users read own document items"
ON document_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM document_analyses da
    WHERE da.id = document_items.document_analysis_id
    AND (da.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- 2. Fix credit_analyses SELECT: remove company_id IS NULL leak
DROP POLICY "Users read own company credit analyses" ON credit_analyses;
CREATE POLICY "Users read own company credit analyses"
ON credit_analyses FOR SELECT TO authenticated
USING (
  company_id = get_my_company_id()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Fix evaluations SELECT: remove company_id IS NULL leak
DROP POLICY "Users read own company evaluations" ON evaluations;
CREATE POLICY "Users read own company evaluations"
ON evaluations FOR SELECT TO authenticated
USING (
  company_id = get_my_company_id()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Restrict profiles SELECT to same company + own + admins
DROP POLICY "Authenticated read all profiles" ON profiles;
CREATE POLICY "Users read own company profiles"
ON profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR company_id = get_my_company_id()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 5. Make pdfs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'pdfs';

-- 6. Make mentoria-lab bucket private
UPDATE storage.buckets SET public = false WHERE id = 'mentoria-lab';

-- 7. Drop overly broad public read policy on pdfs
DROP POLICY "Public read pdfs" ON storage.objects;

-- 8. Harden storage: credit-documents ownership (user path prefix)
DROP POLICY "Authenticated read credit documents" ON storage.objects;
CREATE POLICY "Users read own credit documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'credit-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY "Authenticated upload credit documents" ON storage.objects;
CREATE POLICY "Users upload own credit documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'credit-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY "Authenticated delete credit documents" ON storage.objects;
CREATE POLICY "Users delete own credit documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'credit-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 9. Harden storage: mentoria-lab ownership (user path prefix)
DROP POLICY "Authenticated users can read mentoria files" ON storage.objects;
CREATE POLICY "Users read own mentoria files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mentoria-lab'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY "Authenticated users can upload mentoria files" ON storage.objects;
CREATE POLICY "Users upload own mentoria files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mentoria-lab'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY "Authenticated users can update mentoria files" ON storage.objects;
CREATE POLICY "Users update own mentoria files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'mentoria-lab'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY "Authenticated users can delete mentoria files" ON storage.objects;
CREATE POLICY "Users delete own mentoria files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'mentoria-lab'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 10. Harden pdfs bucket: ownership check
DROP POLICY "Authenticated read pdfs" ON storage.objects;
CREATE POLICY "Users read own pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pdfs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY "Authenticated upload pdfs" ON storage.objects;
CREATE POLICY "Users upload own pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
