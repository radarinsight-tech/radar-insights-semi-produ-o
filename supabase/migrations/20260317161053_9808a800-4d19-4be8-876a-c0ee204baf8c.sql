
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create mentoria_batches table
CREATE TABLE public.mentoria_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  batch_code text NOT NULL UNIQUE,
  source_type text NOT NULL DEFAULT 'pdf',
  original_file_name text,
  total_files_in_source integer NOT NULL DEFAULT 0,
  total_pdfs integer NOT NULL DEFAULT 0,
  ignored_files integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'imported',
  upload_path text,
  summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mentoria_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own batches" ON public.mentoria_batches FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own batches" ON public.mentoria_batches FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own batches" ON public.mentoria_batches FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_mentoria_batches_updated_at
BEFORE UPDATE ON public.mentoria_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create mentoria_batch_files table
CREATE TABLE public.mentoria_batch_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.mentoria_batches(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text,
  extracted_path text,
  file_size integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  atendente text,
  protocolo text,
  data_atendimento text,
  canal text,
  has_audio boolean DEFAULT false,
  nota numeric,
  classificacao text,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mentoria_batch_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own batch files" ON public.mentoria_batch_files FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.mentoria_batches b WHERE b.id = mentoria_batch_files.batch_id AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE POLICY "Users can insert own batch files" ON public.mentoria_batch_files FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.mentoria_batches b WHERE b.id = mentoria_batch_files.batch_id AND b.user_id = auth.uid()));

CREATE POLICY "Users can update own batch files" ON public.mentoria_batch_files FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.mentoria_batches b WHERE b.id = mentoria_batch_files.batch_id AND b.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.mentoria_batches b WHERE b.id = mentoria_batch_files.batch_id AND b.user_id = auth.uid()));
