CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL,
  document_type text NOT NULL,
  version integer NOT NULL,
  title text,
  content jsonb,
  file_url text,
  changed_by uuid REFERENCES auth.users(id),
  change_summary text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read doc versions" ON public.document_versions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Editors can insert doc versions" ON public.document_versions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
