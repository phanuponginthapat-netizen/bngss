
-- Print templates: admin-managed HTML templates for printing
CREATE TABLE IF NOT EXISTS public.print_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  paper TEXT NOT NULL DEFAULT 'A4',
  orientation TEXT NOT NULL DEFAULT 'portrait',
  margin_top NUMERIC NOT NULL DEFAULT 15,
  margin_right NUMERIC NOT NULL DEFAULT 15,
  margin_bottom NUMERIC NOT NULL DEFAULT 15,
  margin_left NUMERIC NOT NULL DEFAULT 20,
  header_html TEXT DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  footer_html TEXT DEFAULT '',
  css TEXT DEFAULT '',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_templates_code ON public.print_templates(code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_print_templates_one_default
  ON public.print_templates(code) WHERE is_default = true;

GRANT SELECT ON public.print_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_templates TO authenticated;
GRANT ALL ON public.print_templates TO service_role;

ALTER TABLE public.print_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read active templates" ON public.print_templates;
CREATE POLICY "Anyone authenticated can read active templates"
  ON public.print_templates FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and directors manage templates" ON public.print_templates;
CREATE POLICY "Admins and directors manage templates"
  ON public.print_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- Versions / history
CREATE TABLE IF NOT EXISTS public.print_template_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.print_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_versions_template ON public.print_template_versions(template_id);

GRANT SELECT, INSERT ON public.print_template_versions TO authenticated;
GRANT ALL ON public.print_template_versions TO service_role;

ALTER TABLE public.print_template_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read versions" ON public.print_template_versions;
CREATE POLICY "Auth read versions"
  ON public.print_template_versions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins write versions" ON public.print_template_versions;
CREATE POLICY "Admins write versions"
  ON public.print_template_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- Auto-bump version + snapshot history on update
CREATE OR REPLACE FUNCTION public.bump_print_template_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.body_html IS DISTINCT FROM OLD.body_html)
       OR (NEW.header_html IS DISTINCT FROM OLD.header_html)
       OR (NEW.footer_html IS DISTINCT FROM OLD.footer_html)
       OR (NEW.css IS DISTINCT FROM OLD.css)
       OR (NEW.paper IS DISTINCT FROM OLD.paper)
       OR (NEW.orientation IS DISTINCT FROM OLD.orientation) THEN
      NEW.version := COALESCE(OLD.version, 1) + 1;
      INSERT INTO public.print_template_versions(template_id, version, snapshot, changed_by)
      VALUES (OLD.id, OLD.version, to_jsonb(OLD), auth.uid());
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_print_template_version ON public.print_templates;
CREATE TRIGGER trg_bump_print_template_version
BEFORE UPDATE ON public.print_templates
FOR EACH ROW EXECUTE FUNCTION public.bump_print_template_version();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_templates;

-- Seed common codes (empty defaults — admins customise)
INSERT INTO public.print_templates(code, name, description, paper, orientation, body_html, is_default, sample_data)
VALUES
  ('pp5', 'แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5)', 'ฟอร์มพิมพ์ ปพ.5', 'A4', 'landscape', '<h2>{{school.name}}</h2><p>ปพ.5 ชั้น {{class.label}} ภาคเรียนที่ {{semester}}/{{year}}</p>', true,
   '{"school":{"name":"โรงเรียนตัวอย่าง"},"class":{"label":"ป.1/1"},"semester":1,"year":2568}'::jsonb),
  ('pp6', 'แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6)', 'ฟอร์มพิมพ์ ปพ.6', 'A4', 'landscape', '<h2>{{school.name}}</h2><p>ปพ.6 ชั้น {{class.label}}</p>', true,
   '{"school":{"name":"โรงเรียนตัวอย่าง"},"class":{"label":"ป.1/1"}}'::jsonb),
  ('id_card', 'บัตรประจำตัวนักเรียน/บุคลากร', 'บัตรประจำตัว', 'A4', 'portrait', '<div>{{person.full_name}}</div>', true, '{}'::jsonb),
  ('certificate', 'เกียรติบัตร', 'เกียรติบัตรทั่วไป', 'A4', 'landscape', '<h1 style="text-align:center;">{{title}}</h1><p style="text-align:center;">{{recipient.name}}</p>', true, '{}'::jsonb),
  ('transcript', 'ระเบียนแสดงผลการเรียน (ปพ.1)', 'Transcript', 'A4', 'portrait', '<h2>{{school.name}}</h2>', true, '{}'::jsonb),
  ('report_card', 'สมุดรายงานประจำตัว', 'สมุดพก', 'A4', 'portrait', '<h2>{{student.full_name}}</h2>', true, '{}'::jsonb);
