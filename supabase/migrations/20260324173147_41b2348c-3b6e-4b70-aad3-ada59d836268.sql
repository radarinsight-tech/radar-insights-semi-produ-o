-- Create the mentoria-lab storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('mentoria-lab', 'mentoria-lab', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload mentoria files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mentoria-lab');

-- Allow authenticated users to read their own files  
CREATE POLICY "Authenticated users can read mentoria files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'mentoria-lab');

-- Allow authenticated users to update their files
CREATE POLICY "Authenticated users can update mentoria files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'mentoria-lab');

-- Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete mentoria files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'mentoria-lab');