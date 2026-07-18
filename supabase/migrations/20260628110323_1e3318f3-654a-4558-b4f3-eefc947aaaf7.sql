CREATE TABLE IF NOT EXISTS public.form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  content_html text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_templates TO authenticated;
GRANT ALL ON public.form_templates TO service_role;

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view form templates"
  ON public.form_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/director can manage form templates"
  ON public.form_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE TRIGGER trg_form_templates_updated_at
  BEFORE UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();