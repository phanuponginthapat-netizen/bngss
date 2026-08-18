-- สร้างตารางที่ frontend ใช้งานแต่ยังไม่มี migration: activities, activity_matches,
-- activity_participants, activity_scores, academic_periods, certificate_templates,
-- certificate_issues, sports_day_meets, sports_day_houses, activity_posts, camera_face_events
-- พร้อม RLS policies ที่เคยถูกข้ามไป (เดิม guard ด้วย to_regclass จึงไม่ถูกสร้างเมื่อตารางยังไม่มี)

-- ============ academic_periods ============
CREATE TABLE IF NOT EXISTS public.academic_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_be INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  final_date DATE,
  midterm_date DATE,
  fix_window_open BOOLEAN NOT NULL DEFAULT false,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_periods TO authenticated;
GRANT ALL ON public.academic_periods TO service_role;

-- ============ sports_day_meets ============
CREATE TABLE IF NOT EXISTS public.sports_day_meets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_period_id UUID REFERENCES public.academic_periods(id),
  academic_year TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  description TEXT,
  venue TEXT,
  cover_image_url TEXT,
  start_date DATE,
  end_date DATE,
  opening_at TIMESTAMPTZ,
  closing_at TIMESTAMPTZ,
  gold_points NUMERIC NOT NULL DEFAULT 0,
  silver_points NUMERIC NOT NULL DEFAULT 0,
  bronze_points NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_day_meets TO authenticated;
GRANT ALL ON public.sports_day_meets TO service_role;

-- ============ sports_day_houses ============
CREATE TABLE IF NOT EXISTS public.sports_day_houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_id UUID NOT NULL REFERENCES public.sports_day_meets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  emblem_url TEXT,
  motto TEXT,
  tent_location TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  advisor_user_id UUID,
  captain_student_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_day_houses TO authenticated;
GRANT ALL ON public.sports_day_houses TO service_role;

-- ============ activities ============
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_period_id UUID REFERENCES public.academic_periods(id),
  sports_day_meet_id UUID REFERENCES public.sports_day_meets(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'กีฬา',
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planned',
  level TEXT DEFAULT 'โรงเรียน',
  bracket_type TEXT NOT NULL DEFAULT 'score',
  rule_preset_key TEXT,
  rules TEXT,
  registration_open BOOLEAN NOT NULL DEFAULT false,
  registration_deadline TIMESTAMPTZ,
  max_participants INTEGER,
  group_count INTEGER,
  scoring_mode TEXT NOT NULL DEFAULT 'point',
  max_score INTEGER,
  supervisor_teachers TEXT,
  criteria JSONB,
  format TEXT NOT NULL DEFAULT 'score',
  allow_alumni BOOLEAN NOT NULL DEFAULT false,
  results_published BOOLEAN NOT NULL DEFAULT false,
  results_published_at TIMESTAMPTZ,
  cover_image_url TEXT,
  gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  live_stream_url TEXT,
  certificate_url TEXT,
  template_id UUID,
  budget NUMERIC,
  participant_names TEXT,
  report_summary TEXT,
  result_summary TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;

-- ============ activity_participants ============
CREATE TABLE IF NOT EXISTS public.activity_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  team_name TEXT,
  group_name TEXT,
  seed INTEGER,
  bib_no TEXT,
  is_team_leader BOOLEAN NOT NULL DEFAULT false,
  sports_day_house_id UUID REFERENCES public.sports_day_houses(id),
  team_logo_url TEXT,
  team_members JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_participants TO authenticated;
GRANT ALL ON public.activity_participants TO service_role;

-- ============ activity_matches ============
CREATE TABLE IF NOT EXISTS public.activity_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  match_no INTEGER NOT NULL DEFAULT 1,
  bracket_slot TEXT,
  participant_a_id UUID REFERENCES public.activity_participants(id) ON DELETE SET NULL,
  participant_b_id UUID REFERENCES public.activity_participants(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES public.activity_participants(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  score_a NUMERIC,
  score_b NUMERIC,
  court TEXT,
  notes TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_matches TO authenticated;
GRANT ALL ON public.activity_matches TO service_role;

-- ============ activity_scores ============
CREATE TABLE IF NOT EXISTS public.activity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.activity_participants(id) ON DELETE CASCADE,
  judge_id UUID,
  rank INTEGER,
  score NUMERIC,
  criteria_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT activity_scores_participant_unique UNIQUE (activity_id, participant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_scores TO authenticated;
GRANT ALL ON public.activity_scores TO service_role;

-- ============ activity_posts ============
CREATE TABLE IF NOT EXISTS public.activity_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  image_url TEXT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_by UUID,
  wall_post_id UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_posts TO authenticated;
GRANT ALL ON public.activity_posts TO service_role;

-- ============ certificate_templates ============
CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  background_url TEXT,
  paper TEXT NOT NULL DEFAULT 'A4',
  orientation TEXT NOT NULL DEFAULT 'landscape',
  font_family TEXT NOT NULL DEFAULT 'Sarabun',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_templates TO authenticated;
GRANT ALL ON public.certificate_templates TO service_role;

-- ============ certificate_issues ============
CREATE TABLE IF NOT EXISTS public.certificate_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.certificate_templates(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  award_text TEXT NOT NULL,
  rank_label TEXT,
  cert_no TEXT NOT NULL,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_issues TO authenticated;
GRANT ALL ON public.certificate_issues TO service_role;

-- ============ camera_face_events ============
CREATE TABLE IF NOT EXISTS public.camera_face_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  camera_id TEXT NOT NULL,
  camera_name TEXT,
  source TEXT NOT NULL DEFAULT 'wizmind',
  event_type TEXT NOT NULL DEFAULT 'face_detected',
  snapshot_path TEXT,
  confidence NUMERIC,
  bbox JSONB,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  matched_user_id UUID,
  matched_person_type TEXT,
  matched_name TEXT,
  match_distance NUMERIC,
  attendance_id UUID
);
GRANT SELECT, UPDATE ON public.camera_face_events TO authenticated;
GRANT ALL ON public.camera_face_events TO service_role;

-- ============ RLS ============
ALTER TABLE public.academic_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_day_meets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_day_houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camera_face_events ENABLE ROW LEVEL SECURITY;

-- academic_periods: ทุกคนอ่านได้, เฉพาะ admin/director จัดการ
DROP POLICY IF EXISTS "anyone read academic_periods" ON public.academic_periods;
CREATE POLICY "anyone read academic_periods" ON public.academic_periods FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage academic_periods" ON public.academic_periods;
CREATE POLICY "Admins can manage academic_periods" ON public.academic_periods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

-- sports_day_meets / houses: ทุกคนอ่านได้, เฉพาะ admin/director จัดการ
DROP POLICY IF EXISTS "anyone read sports_day_meets" ON public.sports_day_meets;
CREATE POLICY "anyone read sports_day_meets" ON public.sports_day_meets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage sports_day_meets" ON public.sports_day_meets;
CREATE POLICY "Admins can manage sports_day_meets" ON public.sports_day_meets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "anyone read sports_day_houses" ON public.sports_day_houses;
CREATE POLICY "anyone read sports_day_houses" ON public.sports_day_houses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage sports_day_houses" ON public.sports_day_houses;
CREATE POLICY "Admins can manage sports_day_houses" ON public.sports_day_houses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

-- activities: staff/observer อ่านได้ + นักเรียนอ่านเฉพาะกิจกรรมที่ลงทะเบียนเปิด
DROP POLICY IF EXISTS "Admins can manage activities" ON public.activities;
CREATE POLICY "Admins can manage activities" ON public.activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "activities read scoped" ON public.activities;
CREATE POLICY "activities read scoped" ON public.activities FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')
    OR public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'observer')
    OR registration_open = true
  );

-- activity_participants: policy เดิม "ap_read_scoped" ถูกสร้างตอนไม่มีตาราง → ข้ามไป
-- สร้างใหม่ให้ตรงกับ 20260719111202
DROP POLICY IF EXISTS "ap_read_scoped" ON public.activity_participants;
CREATE POLICY "ap_read_scoped" ON public.activity_participants FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'director'::app_role)
    OR public.has_role(auth.uid(),'teacher'::app_role)
    OR public.has_role(auth.uid(),'observer'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = activity_participants.student_id AND s.auth_user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "admin manage activity_participants" ON public.activity_participants;
CREATE POLICY "admin manage activity_participants" ON public.activity_participants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
-- นักเรียนสมัครเข้าร่วมได้เอง (เฉพาะตัวเอง)
DROP POLICY IF EXISTS "students join activities" ON public.activity_participants;
CREATE POLICY "students join activities" ON public.activity_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = activity_participants.student_id AND s.auth_user_id = auth.uid()
    )
  );

-- activity_matches
DROP POLICY IF EXISTS "Admins can manage activity_matches" ON public.activity_matches;
CREATE POLICY "Admins can manage activity_matches" ON public.activity_matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "anyone read activity_matches" ON public.activity_matches;
CREATE POLICY "anyone read activity_matches" ON public.activity_matches FOR SELECT TO authenticated USING (true);

-- activity_scores: policy เดิม "as_read_scoped" ข้ามไปตอนไม่มีตาราง → สร้างใหม่
DROP POLICY IF EXISTS "as_read_scoped" ON public.activity_scores;
CREATE POLICY "as_read_scoped" ON public.activity_scores FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'director'::app_role)
    OR public.has_role(auth.uid(),'teacher'::app_role)
    OR public.has_role(auth.uid(),'observer'::app_role)
    OR public.has_role(auth.uid(),'student'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.activity_participants ap
      JOIN public.students s ON s.id = ap.student_id
      WHERE ap.id = activity_scores.participant_id AND s.auth_user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "admin manage activity_scores" ON public.activity_scores;
CREATE POLICY "admin manage activity_scores" ON public.activity_scores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
-- ผู้ตัดสินบันทึกคะแนนได้
DROP POLICY IF EXISTS "judges record scores" ON public.activity_scores;
CREATE POLICY "judges record scores" ON public.activity_scores FOR INSERT TO authenticated
  WITH CHECK (judge_id = auth.uid());

-- activity_posts
DROP POLICY IF EXISTS "anyone read activity_posts" ON public.activity_posts;
CREATE POLICY "anyone read activity_posts" ON public.activity_posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage activity_posts" ON public.activity_posts;
CREATE POLICY "Admins can manage activity_posts" ON public.activity_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

-- certificate_templates: ทุกคนอ่านได้, admin/director จัดการ
DROP POLICY IF EXISTS "anyone read certificate_templates" ON public.certificate_templates;
CREATE POLICY "anyone read certificate_templates" ON public.certificate_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage certificate_templates" ON public.certificate_templates;
CREATE POLICY "Admins can manage certificate_templates" ON public.certificate_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

-- certificate_issues: เจ้าของ (student) / staff อ่านได้, staff บันทึกได้
DROP POLICY IF EXISTS "certificate_issues read scoped" ON public.certificate_issues;
CREATE POLICY "certificate_issues read scoped" ON public.certificate_issues FOR SELECT TO authenticated
  USING (
    public.is_staff_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = certificate_issues.student_id AND s.auth_user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Admins can manage certificate_issues" ON public.certificate_issues;
CREATE POLICY "Admins can manage certificate_issues" ON public.certificate_issues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

-- camera_face_events: เฉพาะ staff อ่าน/แก้ (mirror จาก 20260817-wizmind-bridge.sql)
DROP POLICY IF EXISTS "cfe staff read" ON public.camera_face_events;
CREATE POLICY "cfe staff read" ON public.camera_face_events FOR SELECT TO authenticated
  USING (public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "cfe staff update" ON public.camera_face_events;
CREATE POLICY "cfe staff update" ON public.camera_face_events FOR UPDATE TO authenticated
  USING (public.is_staff_user(auth.uid())) WITH CHECK (public.is_staff_user(auth.uid()));

-- realtime สำหรับ camera_face_events
ALTER TABLE public.camera_face_events REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.camera_face_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============ indexes ============
CREATE INDEX IF NOT EXISTS idx_activities_start_at ON public.activities (start_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_participants_activity ON public.activity_participants (activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_participants_student ON public.activity_participants (student_id);
CREATE INDEX IF NOT EXISTS idx_activity_matches_activity ON public.activity_matches (activity_id, round, match_no);
CREATE INDEX IF NOT EXISTS idx_activity_scores_activity ON public.activity_scores (activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_scores_participant ON public.activity_scores (participant_id);
CREATE INDEX IF NOT EXISTS idx_certificate_issues_template ON public.certificate_issues (template_id);
CREATE INDEX IF NOT EXISTS idx_certificate_issues_student ON public.certificate_issues (student_id);
CREATE INDEX IF NOT EXISTS idx_cfe_camera_created ON public.camera_face_events (camera_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cfe_unprocessed ON public.camera_face_events (created_at DESC) WHERE processed = false;