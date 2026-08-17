CREATE TABLE IF NOT EXISTS public.eform_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom',
  content_html TEXT NOT NULL DEFAULT '',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  page_size TEXT NOT NULL DEFAULT 'A4',
  font_family TEXT NOT NULL DEFAULT 'TH Sarabun New',
  font_size_pt NUMERIC NOT NULL DEFAULT 16,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eform_templates TO authenticated;
GRANT ALL ON public.eform_templates TO service_role;

ALTER TABLE public.eform_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_eform_templates_school ON public.eform_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_eform_templates_active ON public.eform_templates(is_active);

DROP TRIGGER IF EXISTS eform_templates_auto_school_id ON public.eform_templates;
CREATE TRIGGER eform_templates_auto_school_id
BEFORE INSERT ON public.eform_templates
FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id();

DROP TRIGGER IF EXISTS eform_templates_set_updated_at ON public.eform_templates;
CREATE TRIGGER eform_templates_set_updated_at
BEFORE UPDATE ON public.eform_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: same-school members can read active templates; admin/director manage; creator manage own
DROP POLICY IF EXISTS "Same-school members read active templates" ON public.eform_templates;
DROP POLICY IF EXISTS "Same-school members read active templates" ON public.eform_templates;
CREATE POLICY "Same-school members read active templates"
ON public.eform_templates FOR SELECT TO authenticated
USING (
  is_active = true
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Admin/Director manage templates in school" ON public.eform_templates;
DROP POLICY IF EXISTS "Admin/Director manage templates in school" ON public.eform_templates;
CREATE POLICY "Admin/Director manage templates in school"
ON public.eform_templates FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Creator manage own templates" ON public.eform_templates;
DROP POLICY IF EXISTS "Creator manage own templates" ON public.eform_templates;
CREATE POLICY "Creator manage own templates"
ON public.eform_templates FOR ALL TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

DO $$

BEGIN

  IF NOT EXISTS (

    SELECT 1 FROM pg_publication_tables

    WHERE pubname = 'supabase_realtime'

      AND schemaname = 'public'

      AND tablename = 'eform_templates'

  ) THEN

    ALTER PUBLICATION supabase_realtime ADD TABLE public.eform_templates;

  END IF;

END $$;