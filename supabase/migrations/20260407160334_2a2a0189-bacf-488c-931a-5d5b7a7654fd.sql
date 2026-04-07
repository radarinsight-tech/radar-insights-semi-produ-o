
-- Make credit-documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'credit-documents';

-- Drop the public read policy
DROP POLICY IF EXISTS "Public read credit documents" ON storage.objects;

-- Add authenticated read policy
CREATE POLICY "Authenticated read credit documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'credit-documents');
