
-- Document analyses table
CREATE TABLE public.document_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_analysis_id uuid REFERENCES public.credit_analyses(id) ON DELETE SET NULL,
  cpf_cnpj text NOT NULL,
  nome text,
  user_id uuid NOT NULL,
  user_name text,
  decisao_documental text NOT NULL DEFAULT 'aguardando_documentos',
  motivo text,
  observacao text,
  status text NOT NULL DEFAULT 'aguardando_documentos',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read document analyses"
ON public.document_analyses FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated insert document analyses"
ON public.document_analyses FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated update document analyses"
ON public.document_analyses FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete document analyses"
ON public.document_analyses FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Document items table (individual documents with checklist)
CREATE TABLE public.document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_analysis_id uuid NOT NULL REFERENCES public.document_analyses(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  file_url text,
  file_name text,
  documento_recebido boolean NOT NULL DEFAULT false,
  nome_confere boolean NOT NULL DEFAULT false,
  cpf_confere boolean NOT NULL DEFAULT false,
  endereco_confere boolean NOT NULL DEFAULT false,
  legivel boolean NOT NULL DEFAULT false,
  valido boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read document items"
ON public.document_items FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated insert document items"
ON public.document_items FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated update document items"
ON public.document_items FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can delete document items"
ON public.document_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('credit-documents', 'credit-documents', true);

-- Storage policies
CREATE POLICY "Authenticated upload credit documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'credit-documents');

CREATE POLICY "Public read credit documents"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'credit-documents');

CREATE POLICY "Authenticated delete credit documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'credit-documents');
