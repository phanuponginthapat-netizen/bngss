-- ===== 20260622064620 =====
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='iot_devices') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.iot_devices;
  END IF;
END $$;

DROP POLICY IF EXISTS "Admin and Director can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Admin/Director view profiles in their school" ON public.profiles;
DROP POLICY IF EXISTS "Admin/Director view profiles in their school" ON public.profiles;
CREATE POLICY "Admin/Director view profiles in their school"
ON public.profiles FOR SELECT TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Admins manage profiles in their school" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles in their school" ON public.profiles;
CREATE POLICY "Admins manage profiles in their school"
ON public.profiles FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Authenticated can read homework files" ON storage.objects;
DROP POLICY IF EXISTS "Homework files: owner or same-school members" ON storage.objects;
DROP POLICY IF EXISTS "Homework files: owner or same-school members" ON storage.objects;
CREATE POLICY "Homework files: owner or same-school members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'homework-files' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.task_assignments t
      LEFT JOIN public.classrooms c ON c.id = t.classroom_id
      WHERE t.id::text = split_part(name, '/', 1)
        AND (
          t.assigned_by = auth.uid()
          OR t.assigned_to_user_id = auth.uid()
          OR (c.school_id IS NOT NULL AND c.school_id = public.get_user_school_id(auth.uid()))
        )
    )
  )
);

CREATE OR REPLACE FUNCTION public.auto_fill_school_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    NEW.school_id := public.get_user_school_id(auth.uid());
    IF NEW.school_id IS NULL THEN
      SELECT id INTO NEW.school_id FROM public.schools WHERE is_active = true ORDER BY created_at LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END $$;

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

DROP POLICY IF EXISTS "Same-school members read active templates" ON public.eform_templates;
DROP POLICY IF EXISTS "Same-school members read active templates" ON public.eform_templates;
CREATE POLICY "Same-school members read active templates"
ON public.eform_templates FOR SELECT TO authenticated
USING (is_active = true AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid())));

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
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='eform_templates') THEN
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
  END IF;
END $$;

INSERT INTO public.ai_providers (name, provider_type, base_url, model, priority, enabled, supports_vision, supports_json, notes)
VALUES
  ('Lovable AI Gateway', 'lovable', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'google/gemini-2.5-flash', 1, true, true, true, 'ใช้ LOVABLE_API_KEY'),
  ('OpenRouter', 'openrouter', 'https://openrouter.ai/api/v1/chat/completions', 'google/gemini-2.0-flash-exp:free', 2, true, true, true, 'ใช้ OPENROUTER_API_KEY'),
  ('Groq', 'groq', 'https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile', 3, true, false, true, 'ใช้ GROQ_API_KEY'),
  ('DeepSeek', 'deepseek', 'https://api.deepseek.com/v1/chat/completions', 'deepseek-chat', 4, true, false, true, 'ใช้ DEEPSEEK_API_KEY'),
  ('Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini-2.0-flash', 5, true, true, true, 'ใช้ GEMINI_API_KEY'),
  ('DashScope (Qwen)', 'dashscope', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', 'qwen-plus', 6, true, true, true, 'ใช้ DASHSCOPE_API_KEY')
ON CONFLICT DO NOTHING;

ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS reference_grade_level text;
COMMENT ON COLUMN public.classrooms.reference_grade_level IS 'For special-needs classrooms: the actual grade level (ป.1-ม.6) the students belong to for reporting/aggregation. NULL means use grade_level directly.';

DROP POLICY IF EXISTS "Auth users can view homework_assignments" ON public.homework_assignments;
DROP POLICY IF EXISTS "Auth users can view homework_assignments in their school" ON public.homework_assignments;
DROP POLICY IF EXISTS "Auth users can view homework_assignments in their school" ON public.homework_assignments;
CREATE POLICY "Auth users can view homework_assignments in their school"
ON public.homework_assignments FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'academic_events','account_balances','action_plans','admissions','assets',
    'attendance','behavior_records','budget_transactions','classrooms',
    'documents','early_childhood_dev','eforms','enrollments','face_scan_logs',
    'health_measurements','health_records','home_visits','homeroom_records','ict_devices',
    'ict_loans','learning_center_bookings','news_posts','procurement_records','salary_records',
    'schedules','school_lunch_records','school_milk_records','school_test_scores','sdq_records',
    'special_rooms','subjects'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='school_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS "school_scope_restrictive" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "school_scope_restrictive" ON public.%I
           AS RESTRICTIVE FOR ALL TO authenticated
           USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
           WITH CHECK (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))',
        t
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.auto_assign_school_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE only_school uuid;
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT id INTO only_school FROM public.schools WHERE is_active = true ORDER BY created_at LIMIT 1;
    NEW.school_id := only_school;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_auto_school ON public.profiles;
CREATE TRIGGER trg_profiles_auto_school
  BEFORE INSERT OR UPDATE OF school_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_school_id();

UPDATE public.profiles
   SET school_id = (SELECT id FROM public.schools WHERE is_active = true ORDER BY created_at LIMIT 1)
 WHERE school_id IS NULL;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'academic_events','account_balances','action_plans','admissions','assets',
    'attendance','behavior_records','budget_transactions','classrooms',
    'documents','early_childhood_dev','eforms','enrollments','face_scan_logs',
    'health_measurements','health_records','home_visits','homeroom_records','ict_devices',
    'ict_loans','learning_center_bookings','news_posts','procurement_records','salary_records',
    'schedules','school_lunch_records','school_milk_records','school_test_scores','sdq_records',
    'special_rooms','subjects','homework_assignments','hub_projects','personnel',
    'portfolio_items','students','wall_posts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='school_id') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_school_id ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_auto_school_id BEFORE INSERT ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id()', t
      );
    END IF;
  END LOOP;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='students') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.students;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pdpa_consents') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.pdpa_consents;
  END IF;
END $$;

DROP POLICY IF EXISTS "Admin/director manage ai_providers" ON public.ai_providers;
DROP POLICY IF EXISTS "service_role only ai_providers" ON public.ai_providers;
DROP POLICY IF EXISTS "service_role only ai_providers" ON public.ai_providers;
CREATE POLICY "service_role only ai_providers" ON public.ai_providers
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view cms settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings;
DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings;
CREATE POLICY "Anon view public cms keys" ON public.cms_settings
  FOR SELECT TO anon
  USING (key NOT ILIKE 'id_card%' AND key NOT ILIKE '%template%' AND key NOT ILIKE '%secret%' AND key NOT ILIKE '%internal%' AND key NOT ILIKE 'admin_%');
DROP POLICY IF EXISTS "Auth view all cms settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Auth view all cms settings" ON public.cms_settings;
CREATE POLICY "Auth view all cms settings" ON public.cms_settings
  FOR SELECT TO authenticated USING (true);

ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reset_content_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _summary jsonb := '{}'::jsonb;
  _tables text[] := ARRAY[
    'attendance','behavior_records','student_leaves','staff_leaves','home_visits',
    'sdq_records','student_screenings','health_records','health_measurements',
    'vaccine_records','early_childhood_dev',
    'student_scores','student_assessment_scores','student_column_scores',
    'exam_submissions','exam_questions','exam_sheets','exams','homework_assignments',
    'school_test_scores','pp5_files','pp6_files','homeroom_records','id_plan_records',
    'notifications','inbox_items','eform_attachments','eform_recipients','eforms',
    'document_recipients','documents','task_assignments','emergency_broadcasts',
    'notification_delivery_log',
    'ai_chat_logs','ai_usage_logs','ai_user_memory','audit_logs','error_logs',
    'rate_limit_logs','google_chat_logs','district_feed_logs','district_snapshots',
    'face_scan_logs','face_registration_history','face_registration_requests',
    'student_face_descriptors','time_clock','iot_readings','mascot_advice_cache',
    'archive_logs',
    'wall_post_reactions','wall_post_comments','wall_posts','social_posts',
    'portfolio_items',
    'garbage_user_badges','garbage_redemptions','garbage_deposits',
    'garbage_student_points','garbage_personnel_points',
    'learning_center_bookings','school_lunch_records','school_milk_records',
    'ict_loans','asset_damage_reports','procurement_records','budget_transactions',
    'salary_records','account_balances','student_subsidies',
    'hub_project_expenses','hub_project_updates','hub_project_budgets','hub_projects',
    'substitute_teaching','staff_evaluations','personnel_assessments',
    'pa_indicator_scores','pa_agreements','action_plans',
    'push_subscriptions','line_sessions'
  ];
  _t text;
  _count bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admin can reset content data';
  END IF;
  FOREACH _t IN ARRAY _tables LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', _t) INTO _count;
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', _t);
      _summary := _summary || jsonb_build_object(_t, _count);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
  INSERT INTO public.school_settings (setting_key, setting_value)
  VALUES ('last_content_reset', jsonb_build_object('ran_at', now(), 'ran_by', auth.uid(), 'summary', _summary)::text)
  ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
  RETURN jsonb_build_object('ok', true, 'summary', _summary);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_content_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_content_data() TO service_role;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='google_chat_webhooks') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.google_chat_webhooks;
  END IF;
END $$;

DROP POLICY IF EXISTS "Authenticated can broadcast realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can read realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Deny all realtime broadcast/presence by default" ON realtime.messages;
DROP POLICY IF EXISTS "Deny all realtime broadcast/presence by default" ON realtime.messages;
CREATE POLICY "Deny all realtime broadcast/presence by default"
ON realtime.messages FOR SELECT TO authenticated USING (false);
DROP POLICY IF EXISTS "Deny all realtime inserts by default" ON realtime.messages;
DROP POLICY IF EXISTS "Deny all realtime inserts by default" ON realtime.messages;
CREATE POLICY "Deny all realtime inserts by default"
ON realtime.messages FOR INSERT TO authenticated WITH CHECK (false);

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS weight_assignment numeric NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS weight_midterm    numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS weight_final      numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS weight_attendance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weeks_per_semester integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS pp5_period_dates date[] NOT NULL DEFAULT '{}'::date[];

ALTER TABLE public.subject_score_columns
  ADD COLUMN IF NOT EXISTS half text NOT NULL DEFAULT 'pre',
  ADD COLUMN IF NOT EXISTS indicator_id uuid REFERENCES public.subject_indicators(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_subject_score_columns_indicator ON public.subject_score_columns(indicator_id);

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
  background_url TEXT,
  overlay_mode BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_templates_code ON public.print_templates(code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_print_templates_one_default ON public.print_templates(code) WHERE is_default = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_templates TO authenticated;
GRANT ALL ON public.print_templates TO service_role;
ALTER TABLE public.print_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read active templates" ON public.print_templates;
DROP POLICY IF EXISTS "Anyone authenticated can read active templates" ON public.print_templates;
CREATE POLICY "Anyone authenticated can read active templates"
  ON public.print_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins and directors manage templates" ON public.print_templates;
DROP POLICY IF EXISTS "Admins and directors manage templates" ON public.print_templates;
CREATE POLICY "Admins and directors manage templates"
  ON public.print_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

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
DROP POLICY IF EXISTS "Auth read versions" ON public.print_template_versions;
CREATE POLICY "Auth read versions"
  ON public.print_template_versions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins write versions" ON public.print_template_versions;
DROP POLICY IF EXISTS "Admins write versions" ON public.print_template_versions;
CREATE POLICY "Admins write versions"
  ON public.print_template_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE OR REPLACE FUNCTION public.bump_print_template_version()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='print_templates') THEN
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'print_templates'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.print_templates;
      END IF;
    END $$;
  END IF;
END $$;

INSERT INTO public.print_templates(code, name, description, paper, orientation, body_html, is_default, sample_data)
VALUES
  ('pp5', 'แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5)', 'ฟอร์มพิมพ์ ปพ.5', 'A4', 'landscape', '<h2>{{school.name}}</h2><p>ปพ.5 ชั้น {{class.label}} ภาคเรียนที่ {{semester}}/{{year}}</p>', true,
   '{"school":{"name":"โรงเรียนตัวอย่าง"},"class":{"label":"ป.1/1"},"semester":1,"year":2568}'::jsonb),
  ('pp6', 'แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6)', 'ฟอร์มพิมพ์ ปพ.6', 'A4', 'landscape', '<h2>{{school.name}}</h2><p>ปพ.6 ชั้น {{class.label}}</p>', true,
   '{"school":{"name":"โรงเรียนตัวอย่าง"},"class":{"label":"ป.1/1"}}'::jsonb),
  ('id_card', 'บัตรประจำตัวนักเรียน/บุคลากร', 'บัตรประจำตัว', 'A4', 'portrait', '<div>{{person.full_name}}</div>', true, '{}'::jsonb),
  ('certificate', 'เกียรติบัตร', 'เกียรติบัตรทั่วไป', 'A4', 'landscape', '<h1 style="text-align:center;">{{title}}</h1><p style="text-align:center;">{{recipient.name}}</p>', true, '{}'::jsonb),
  ('transcript', 'ระเบียนแสดงผลการเรียน (ปพ.1)', 'Transcript', 'A4', 'portrait', '<h2>{{school.name}}</h2>', true, '{}'::jsonb),
  ('report_card', 'สมุดรายงานประจำตัว', 'สมุดพก', 'A4', 'portrait', '<h2>{{student.full_name}}</h2>', true, '{}'::jsonb)
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  BEGIN REVOKE EXECUTE ON FUNCTION public.auto_assign_school_id() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.bump_print_template_version() FROM anon, authenticated, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.get_user_school_id(uuid) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.is_homeroom_of_classroom(uuid, uuid) FROM anon, PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;