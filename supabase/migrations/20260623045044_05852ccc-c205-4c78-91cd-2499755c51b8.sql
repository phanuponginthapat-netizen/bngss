
ALTER TABLE public.eform_templates
  ADD COLUMN IF NOT EXISTS template_mode TEXT NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_overlay_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "Authenticated read eform pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'eform-pdfs');

CREATE POLICY "Authenticated upload eform pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'eform-pdfs');

CREATE POLICY "Authenticated update eform pdfs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'eform-pdfs');

CREATE POLICY "Authenticated delete eform pdfs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'eform-pdfs');
