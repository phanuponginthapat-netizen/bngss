
CREATE TABLE public.pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  description text,
  source_pdf_url text NOT NULL,
  source_pdf_path text,
  page_count integer NOT NULL DEFAULT 1,
  page_width numeric,
  page_height numeric,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_schema jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_templates TO authenticated;
GRANT ALL ON public.pdf_templates TO service_role;

ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read active templates"
  ON public.pdf_templates FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "admin director manage templates"
  ON public.pdf_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE TRIGGER pdf_templates_updated_at
  BEFORE UPDATE ON public.pdf_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pdf_templates_category ON public.pdf_templates(category) WHERE is_active = true;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pdf_templates;

-- Storage policies (bucket created via tool separately)
CREATE POLICY "public read pdf-templates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pdf-templates');

CREATE POLICY "admin director write pdf-templates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pdf-templates' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')));

CREATE POLICY "admin director update pdf-templates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pdf-templates' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')));

CREATE POLICY "admin director delete pdf-templates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pdf-templates' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')));
