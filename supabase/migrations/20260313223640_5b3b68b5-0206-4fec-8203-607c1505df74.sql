-- Add pdf_url column to evaluations
ALTER TABLE public.evaluations ADD COLUMN pdf_url text;

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', true);

-- Allow authenticated users to upload PDFs
CREATE POLICY "Authenticated upload pdfs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pdfs');

-- Allow authenticated users to read PDFs
CREATE POLICY "Authenticated read pdfs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pdfs');

-- Allow public read for PDF URLs (since bucket is public)
CREATE POLICY "Public read pdfs" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'pdfs');