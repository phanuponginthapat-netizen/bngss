-- dashboard_shortcuts
CREATE TABLE IF NOT EXISTS public.dashboard_shortcuts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_th TEXT NOT NULL,
  label_en TEXT NOT NULL,
  icon TEXT,
  logo_url TEXT,
  bg_class TEXT NOT NULL DEFAULT 'bg-gradient-to-br from-slate-400 to-slate-600',
  target_url TEXT NOT NULL,
  open_in_new_tab BOOLEAN NOT NULL DEFAULT false,
  visible_roles TEXT[] NOT NULL DEFAULT ARRAY['admin','director','teacher','student','alumni','parent']::text[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dashboard_shortcuts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dashboard_shortcuts TO authenticated;
GRANT ALL ON public.dashboard_shortcuts TO service_role;
ALTER TABLE public.dashboard_shortcuts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active shortcuts" ON public.dashboard_shortcuts;
CREATE POLICY "Anyone can view active shortcuts" ON public.dashboard_shortcuts FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can insert shortcuts" ON public.dashboard_shortcuts;
CREATE POLICY "Admins can insert shortcuts" ON public.dashboard_shortcuts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update shortcuts" ON public.dashboard_shortcuts;
CREATE POLICY "Admins can update shortcuts" ON public.dashboard_shortcuts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can delete shortcuts" ON public.dashboard_shortcuts;
CREATE POLICY "Admins can delete shortcuts" ON public.dashboard_shortcuts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_dashboard_shortcuts_updated_at ON public.dashboard_shortcuts;
CREATE TRIGGER trg_dashboard_shortcuts_updated_at BEFORE UPDATE ON public.dashboard_shortcuts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='dashboard_shortcuts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_shortcuts;
  END IF;
END $$;

INSERT INTO public.dashboard_shortcuts (label_th, label_en, icon, bg_class, target_url, sort_order) VALUES
('เช็คชื่อ-การมาเรียน','Attendance','ClipboardList','bg-gradient-to-br from-emerald-400 to-teal-600','/dashboard/student/attendance',10),
('สแกนนักเรียน','Scan Student','ScanFace','bg-gradient-to-br from-cyan-400 to-blue-600','/dashboard/student/face-scan',20),
('ตารางเรียน-ตารางสอน','Schedule','Calendar','bg-gradient-to-br from-amber-400 to-orange-500','/dashboard/academic/schedule',30),
('การบ้าน','Homework','BookOpenCheck','bg-gradient-to-br from-lime-400 to-emerald-600','/dashboard/homework',40),
('บันทึกผลการเรียน ปพ.5','ปพ.5','ClipboardCheck','bg-gradient-to-br from-fuchsia-400 to-purple-600','/dashboard/academic/pp5',50),
('บันทึกพฤติกรรม','Behavior','Shield','bg-gradient-to-br from-rose-400 to-pink-600','/dashboard/student/behavior',60),
('การลานักเรียน','Leave','FileText','bg-gradient-to-br from-yellow-400 to-amber-500','/dashboard/student/leave',70),
('สุขภาพ','Health','Heart','bg-gradient-to-br from-red-400 to-rose-600','/dashboard/student/health-trend',80),
('ข่าวสาร & ประกาศ','News','Megaphone','bg-gradient-to-br from-orange-400 to-red-500','/dashboard/admin/news',90),
('งบประมาณ & บัญชี','Budget','Wallet','bg-gradient-to-br from-green-400 to-emerald-600','/dashboard/finance/budget',100),
('ทรัพย์สิน & ครุภัณฑ์','Assets','Package','bg-gradient-to-br from-indigo-400 to-purple-600','/dashboard/finance/assets',110),
('บุคลากร','HR','Users','bg-gradient-to-br from-violet-400 to-fuchsia-600','/dashboard/hr/personnel',120),
('กล่องข้อความ','Inbox','Inbox','bg-gradient-to-br from-sky-400 to-blue-600','/dashboard/inbox',130),
('ศูนย์รวมโมดูล','Module Hub','Network','bg-gradient-to-br from-slate-400 to-slate-600','/dashboard/hub',140)
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  CREATE TYPE public.dept_role AS ENUM ('member','head','deputy_head','section_head');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.user_departments
  ADD COLUMN IF NOT EXISTS dept_role public.dept_role NOT NULL DEFAULT 'member';

UPDATE public.user_departments SET dept_role = 'head' WHERE is_head = true AND dept_role = 'member';

CREATE OR REPLACE FUNCTION public.sync_user_dept_is_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.is_head := (NEW.dept_role IN ('head','deputy_head')); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS user_departments_sync_is_head ON public.user_departments;
CREATE TRIGGER user_departments_sync_is_head
BEFORE INSERT OR UPDATE OF dept_role ON public.user_departments
FOR EACH ROW EXECUTE FUNCTION public.sync_user_dept_is_head();

CREATE TABLE IF NOT EXISTS public.user_subject_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_group text NOT NULL,
  group_role public.dept_role NOT NULL DEFAULT 'member',
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_group)
);
CREATE INDEX IF NOT EXISTS idx_user_subject_groups_user ON public.user_subject_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subject_groups_group ON public.user_subject_groups(subject_group);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subject_groups TO authenticated;
GRANT ALL ON public.user_subject_groups TO service_role;
ALTER TABLE public.user_subject_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own subject groups" ON public.user_subject_groups;
CREATE POLICY "Users view own subject groups" ON public.user_subject_groups FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
DROP POLICY IF EXISTS "Admin manage subject groups" ON public.user_subject_groups;
CREATE POLICY "Admin manage subject groups" ON public.user_subject_groups FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP TRIGGER IF EXISTS update_user_subject_groups_updated_at ON public.user_subject_groups;
CREATE TRIGGER update_user_subject_groups_updated_at
BEFORE UPDATE ON public.user_subject_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_user_dept_role(_user_id uuid, _dept public.school_department)
RETURNS public.dept_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT dept_role FROM public.user_departments
   WHERE user_id = _user_id AND department = _dept LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_dept_role(uuid, public.school_department) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_dept_role(uuid, public.school_department) TO authenticated;

CREATE TABLE IF NOT EXISTS public.kiosk_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hostname text,
  user_agent text,
  ip_address text,
  status text NOT NULL DEFAULT 'online',
  kiosk_mode text,
  config_updated_at timestamptz,
  uptime_sec integer NOT NULL DEFAULT 0,
  screen_resolution text,
  extension_installed boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_devices TO authenticated;
GRANT ALL ON public.kiosk_devices TO service_role;
ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can upsert own device row" ON public.kiosk_devices;
CREATE POLICY "users can upsert own device row" ON public.kiosk_devices FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
DROP POLICY IF EXISTS "users can update own device row" ON public.kiosk_devices;
CREATE POLICY "users can update own device row" ON public.kiosk_devices FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher'))
WITH CHECK (user_id = auth.uid() OR user_id IS NULL OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher'));
DROP POLICY IF EXISTS "staff can view all devices" ON public.kiosk_devices;
CREATE POLICY "staff can view all devices" ON public.kiosk_devices FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher') OR user_id = auth.uid());
DROP POLICY IF EXISTS "admins can delete devices" ON public.kiosk_devices;
CREATE POLICY "admins can delete devices" ON public.kiosk_devices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE INDEX IF NOT EXISTS kiosk_devices_last_seen_idx ON public.kiosk_devices(last_seen_at DESC);

DROP TRIGGER IF EXISTS kiosk_devices_updated_at ON public.kiosk_devices;
CREATE TRIGGER kiosk_devices_updated_at BEFORE UPDATE ON public.kiosk_devices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='kiosk_devices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kiosk_devices;
  END IF;
END $$;
ALTER TABLE public.kiosk_devices REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS public.home_visit_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  academic_year integer NOT NULL,
  semester integer NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  reporter_name text,
  reporter_position text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year, semester)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_visit_summaries TO authenticated;
GRANT ALL ON public.home_visit_summaries TO service_role;
ALTER TABLE public.home_visit_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view home visit summaries" ON public.home_visit_summaries;
CREATE POLICY "Staff can view home visit summaries" ON public.home_visit_summaries FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role));
DROP POLICY IF EXISTS "Staff can insert home visit summaries" ON public.home_visit_summaries;
CREATE POLICY "Staff can insert home visit summaries" ON public.home_visit_summaries FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role));
DROP POLICY IF EXISTS "Staff can update home visit summaries" ON public.home_visit_summaries;
CREATE POLICY "Staff can update home visit summaries" ON public.home_visit_summaries FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role));
DROP POLICY IF EXISTS "Admin/director can delete home visit summaries" ON public.home_visit_summaries;
CREATE POLICY "Admin/director can delete home visit summaries" ON public.home_visit_summaries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role));

DROP TRIGGER IF EXISTS trg_home_visit_summaries_updated ON public.home_visit_summaries;
CREATE TRIGGER trg_home_visit_summaries_updated BEFORE UPDATE ON public.home_visit_summaries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.line_richmenu_state (
  role TEXT PRIMARY KEY,
  richmenu_id TEXT,
  content_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto-svg',
  image_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT line_richmenu_state_role_check CHECK (role IN ('default','parent','teacher','director','admin')),
  CONSTRAINT line_richmenu_state_source_check CHECK (source IN ('auto-svg','upload'))
);
GRANT SELECT ON public.line_richmenu_state TO authenticated;
GRANT ALL ON public.line_richmenu_state TO service_role;
ALTER TABLE public.line_richmenu_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read richmenu state" ON public.line_richmenu_state;
CREATE POLICY "admin read richmenu state" ON public.line_richmenu_state FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

ALTER TABLE public.homework_assignments
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS answer_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_pages int,
  ADD COLUMN IF NOT EXISTS worksheet_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_score numeric;

CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  school_id uuid,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  score numeric,
  auto_score numeric,
  final_score numeric,
  field_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  feedback text,
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_submissions TO authenticated;
GRANT ALL ON public.homework_submissions TO service_role;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students manage own submissions" ON public.homework_submissions;
CREATE POLICY "students manage own submissions" ON public.homework_submissions FOR ALL TO authenticated
USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
DROP POLICY IF EXISTS "assignment owner can view submissions" ON public.homework_submissions;
CREATE POLICY "assignment owner can view submissions" ON public.homework_submissions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.homework_assignments a WHERE a.id = assignment_id AND (a.created_by = auth.uid() OR a.school_id = public.get_user_school_id(auth.uid()))));
DROP POLICY IF EXISTS "assignment owner can grade submissions" ON public.homework_submissions;
CREATE POLICY "assignment owner can grade submissions" ON public.homework_submissions FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.homework_assignments a WHERE a.id = assignment_id AND (a.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))));
DROP POLICY IF EXISTS "admins manage all submissions" ON public.homework_submissions;
CREATE POLICY "admins manage all submissions" ON public.homework_submissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role));

CREATE OR REPLACE FUNCTION public.tg_homework_submissions_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_homework_submissions_updated ON public.homework_submissions;
CREATE TRIGGER trg_homework_submissions_updated BEFORE UPDATE ON public.homework_submissions
FOR EACH ROW EXECUTE FUNCTION public.tg_homework_submissions_updated();

ALTER TABLE public.homework_submissions REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='homework_submissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.homework_submissions;
  END IF;
END $$;