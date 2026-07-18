
CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  description text,
  cover_url text,
  category text,
  location text,
  meeting_day text,
  meeting_period text,
  academic_year integer,
  semester integer,
  capacity integer DEFAULT 30,
  is_special boolean NOT NULL DEFAULT false,
  special_kind text,
  status text NOT NULL DEFAULT 'open',
  recruit_open boolean NOT NULL DEFAULT true,
  recruit_start date,
  recruit_end date,
  goals text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.club_advisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_lead boolean NOT NULL DEFAULT false,
  role_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, teacher_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_advisors TO authenticated;
GRANT ALL ON public.club_advisors TO service_role;
ALTER TABLE public.club_advisors ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  position text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  note text,
  UNIQUE (club_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_club_members_club ON public.club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_student ON public.club_members(student_id);

CREATE TABLE IF NOT EXISTS public.club_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_applications TO authenticated;
GRANT ALL ON public.club_applications TO service_role;
ALTER TABLE public.club_applications ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.club_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  note text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, student_id, session_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_attendance TO authenticated;
GRANT ALL ON public.club_attendance TO service_role;
ALTER TABLE public.club_attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_club_attendance_club_date ON public.club_attendance(club_id, session_date);

CREATE TABLE IF NOT EXISTS public.club_works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_url text,
  attachments jsonb DEFAULT '[]'::jsonb,
  work_date date,
  award text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_works TO authenticated;
GRANT ALL ON public.club_works TO service_role;
ALTER TABLE public.club_works ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.club_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'general',
  pinned boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  audience text NOT NULL DEFAULT 'members',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_announcements TO authenticated;
GRANT ALL ON public.club_announcements TO service_role;
ALTER TABLE public.club_announcements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_club_advisor(_club uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.club_advisors WHERE club_id = _club AND teacher_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_club_member(_club uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members cm
    JOIN public.students s ON s.id = cm.student_id
    WHERE cm.club_id = _club AND s.auth_user_id = _user AND cm.status='active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_president(_club uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members cm
    JOIN public.students s ON s.id = cm.student_id
    WHERE cm.club_id = _club AND s.auth_user_id = _user
      AND cm.position IN ('president','vice','secretary','committee')
      AND cm.status='active'
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_clubs_touch ON public.clubs;
CREATE TRIGGER trg_clubs_touch BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_club_works_touch ON public.club_works;
CREATE TRIGGER trg_club_works_touch BEFORE UPDATE ON public.club_works FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY clubs_select ON public.clubs FOR SELECT TO authenticated USING (true);
CREATE POLICY clubs_admin_all ON public.clubs FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')))
  WITH CHECK ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));
CREATE POLICY clubs_advisor_update ON public.clubs FOR UPDATE TO authenticated
  USING (public.is_club_advisor(id, auth.uid()))
  WITH CHECK (public.is_club_advisor(id, auth.uid()));

CREATE POLICY adv_select ON public.club_advisors FOR SELECT TO authenticated USING (true);
CREATE POLICY adv_admin_all ON public.club_advisors FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')))
  WITH CHECK ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

CREATE POLICY mem_select ON public.club_members FOR SELECT TO authenticated USING (true);
CREATE POLICY mem_admin_all ON public.club_members FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')))
  WITH CHECK ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));
CREATE POLICY mem_advisor_all ON public.club_members FOR ALL TO authenticated
  USING (public.is_club_advisor(club_id, auth.uid()))
  WITH CHECK (public.is_club_advisor(club_id, auth.uid()));

CREATE POLICY app_select_all ON public.club_applications FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
         OR public.is_club_advisor(club_id, auth.uid())
         OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.auth_user_id = auth.uid()));
CREATE POLICY app_insert_student ON public.club_applications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.auth_user_id = auth.uid()));
CREATE POLICY app_update_staff ON public.club_applications FOR UPDATE TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
         OR public.is_club_advisor(club_id, auth.uid()))
  WITH CHECK (true);
CREATE POLICY app_delete_staff ON public.club_applications FOR DELETE TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
         OR public.is_club_advisor(club_id, auth.uid()));

CREATE POLICY att_select ON public.club_attendance FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
         OR public.is_club_advisor(club_id, auth.uid())
         OR public.is_club_president(club_id, auth.uid())
         OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.auth_user_id = auth.uid()));
CREATE POLICY att_write_staff ON public.club_attendance FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
         OR public.is_club_advisor(club_id, auth.uid())
         OR public.is_club_president(club_id, auth.uid()))
  WITH CHECK ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
         OR public.is_club_advisor(club_id, auth.uid())
         OR public.is_club_president(club_id, auth.uid()));

CREATE POLICY works_select ON public.club_works FOR SELECT TO authenticated USING (true);
CREATE POLICY works_write ON public.club_works FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
         OR public.is_club_advisor(club_id, auth.uid())
         OR public.is_club_president(club_id, auth.uid()))
  WITH CHECK ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
         OR public.is_club_advisor(club_id, auth.uid())
         OR public.is_club_president(club_id, auth.uid()));

CREATE POLICY ann_select ON public.club_announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY ann_write ON public.club_announcements FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
         OR public.is_club_advisor(club_id, auth.uid())
         OR public.is_club_president(club_id, auth.uid()))
  WITH CHECK ((SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
         OR public.is_club_advisor(club_id, auth.uid())
         OR public.is_club_president(club_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.clubs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_advisors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_works;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_announcements;

INSERT INTO public.clubs (name, code, description, category, is_special, special_kind, status, recruit_open, goals)
VALUES (
  'TO BE NUMBER ONE',
  'TBNO',
  'ชมรม TO BE NUMBER ONE ในทูลกระหม่อมหญิงอุบลรัตนราชกัญญา สิริวัฒนาพรรณวดี — เป็นหนึ่งโดยไม่พึ่งยาเสพติด เน้นกิจกรรมสร้างสรรค์ พัฒนา EQ ใช้เวลาว่างให้เกิดประโยชน์ เพื่อนช่วยเพื่อน และศูนย์เพื่อนใจ TO BE NUMBER ONE',
  'ชมรมพิเศษ', true, 'tobenumberone', 'open', true,
  '3 ก: กรม-กรอง-ก่อ • 3 ยุทธศาสตร์: รณรงค์ปลุกจิตสำนึก, เสริมสร้างภูมิคุ้มกันทางจิตใจ, สร้างและพัฒนาเครือข่าย'
)
ON CONFLICT (code) DO NOTHING;
