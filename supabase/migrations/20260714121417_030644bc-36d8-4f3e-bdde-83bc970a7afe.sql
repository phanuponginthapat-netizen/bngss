-- browser_shortcuts
CREATE TABLE IF NOT EXISTS public.browser_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_th TEXT NOT NULL,
  label_en TEXT NOT NULL,
  icon TEXT,
  logo_url TEXT,
  bg_class TEXT NOT NULL DEFAULT 'bg-gradient-to-br from-sky-400 to-blue-600',
  target_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  visible_roles TEXT[] NOT NULL DEFAULT ARRAY['admin','director','teacher','student','alumni','parent'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.browser_shortcuts TO authenticated;
GRANT ALL ON public.browser_shortcuts TO service_role;
ALTER TABLE public.browser_shortcuts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read shortcuts" ON public.browser_shortcuts;
DROP POLICY IF EXISTS "authenticated can read shortcuts" ON public.browser_shortcuts;
CREATE POLICY "authenticated can read shortcuts" ON public.browser_shortcuts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admins manage shortcuts" ON public.browser_shortcuts;
DROP POLICY IF EXISTS "admins manage shortcuts" ON public.browser_shortcuts;
CREATE POLICY "admins manage shortcuts" ON public.browser_shortcuts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP TRIGGER IF EXISTS trg_browser_shortcuts_updated ON public.browser_shortcuts;
CREATE TRIGGER trg_browser_shortcuts_updated BEFORE UPDATE ON public.browser_shortcuts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='browser_shortcuts') THEN
          IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'browser_shortcuts'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.browser_shortcuts;
      END IF;
  END IF;
END $$;

INSERT INTO public.browser_shortcuts (label_th, label_en, icon, target_url, bg_class, sort_order) VALUES
  ('Docs','Docs','FileText','https://docs.google.com','bg-gradient-to-br from-sky-400 to-blue-600',10),
  ('Sheets','Sheets','Sheet','https://sheets.google.com','bg-gradient-to-br from-green-400 to-emerald-600',20),
  ('Slides','Slides','Presentation','https://slides.google.com','bg-gradient-to-br from-yellow-400 to-amber-500',30),
  ('Drive','Drive','HardDrive','https://drive.google.com','bg-gradient-to-br from-lime-400 to-emerald-600',40),
  ('Gmail','Gmail','Mail','https://mail.google.com','bg-gradient-to-br from-red-400 to-rose-600',50),
  ('Classroom','Classroom','GraduationCap','https://classroom.google.com','bg-gradient-to-br from-green-400 to-emerald-600',60),
  ('YouTube','YouTube','Youtube','https://www.youtube.com','bg-gradient-to-br from-red-400 to-rose-600',70),
  ('Translate','Translate','Languages','https://translate.google.com','bg-gradient-to-br from-cyan-400 to-blue-600',80),
  ('Maps','Maps','Map','https://www.google.com/maps','bg-gradient-to-br from-orange-400 to-red-500',90),
  ('Wikipedia','Wikipedia','BookOpen','https://th.wikipedia.org','bg-gradient-to-br from-slate-400 to-slate-600',100)
ON CONFLICT DO NOTHING;

-- lesson_plans
CREATE TABLE IF NOT EXISTS public.lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  school_id uuid,
  academic_year integer NOT NULL,
  semester integer NOT NULL CHECK (semester IN (1,2)),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL,
  grade_level text,
  unit_no integer,
  unit_title text NOT NULL,
  lesson_no integer,
  lesson_title text,
  learning_standard text,
  indicators text[] DEFAULT '{}',
  objectives text,
  key_concept text,
  content text,
  teaching_process text,
  materials text,
  assessment_method text,
  assessment_criteria text,
  competencies text[] DEFAULT '{}',
  desired_characteristics text[] DEFAULT '{}',
  reading_thinking_writing text,
  hours integer DEFAULT 1,
  attachment_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','revise_needed')),
  reviewer_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  reviewer_note text,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_user ON public.lesson_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher ON public.lesson_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_year_sem ON public.lesson_plans(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_subject ON public.lesson_plans(subject_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_status ON public.lesson_plans(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plans TO authenticated;
GRANT ALL ON public.lesson_plans TO service_role;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_plans_own_select" ON public.lesson_plans;
DROP POLICY IF EXISTS "lesson_plans_own_select" ON public.lesson_plans;
CREATE POLICY "lesson_plans_own_select" ON public.lesson_plans FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "lesson_plans_own_insert" ON public.lesson_plans;
DROP POLICY IF EXISTS "lesson_plans_own_insert" ON public.lesson_plans;
CREATE POLICY "lesson_plans_own_insert" ON public.lesson_plans FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "lesson_plans_own_update" ON public.lesson_plans;
DROP POLICY IF EXISTS "lesson_plans_own_update" ON public.lesson_plans;
CREATE POLICY "lesson_plans_own_update" ON public.lesson_plans FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status <> 'approved') WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "lesson_plans_own_delete" ON public.lesson_plans;
DROP POLICY IF EXISTS "lesson_plans_own_delete" ON public.lesson_plans;
CREATE POLICY "lesson_plans_own_delete" ON public.lesson_plans FOR DELETE TO authenticated
USING (user_id = auth.uid() AND status IN ('draft','revise_needed'));
DROP POLICY IF EXISTS "lesson_plans_admin_all" ON public.lesson_plans;
DROP POLICY IF EXISTS "lesson_plans_admin_all" ON public.lesson_plans;
CREATE POLICY "lesson_plans_admin_all" ON public.lesson_plans FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
DROP POLICY IF EXISTS "lesson_plans_peer_view_approved" ON public.lesson_plans;
DROP POLICY IF EXISTS "lesson_plans_peer_view_approved" ON public.lesson_plans;
CREATE POLICY "lesson_plans_peer_view_approved" ON public.lesson_plans FOR SELECT TO authenticated
USING (status = 'approved');

-- teaching_logbook
CREATE TABLE IF NOT EXISTS public.teaching_logbook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  school_id uuid,
  teaching_date date NOT NULL,
  period integer,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL,
  lesson_plan_id uuid REFERENCES public.lesson_plans(id) ON DELETE SET NULL,
  topic text NOT NULL,
  activities text,
  students_total integer,
  students_present integer,
  students_absent integer,
  teaching_result text,
  problems text,
  solutions text,
  reflection text,
  next_plan text,
  evidence_urls text[] DEFAULT '{}',
  academic_year integer,
  semester integer CHECK (semester IN (1,2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logbook_user ON public.teaching_logbook(user_id);
CREATE INDEX IF NOT EXISTS idx_logbook_teacher ON public.teaching_logbook(teacher_id);
CREATE INDEX IF NOT EXISTS idx_logbook_date ON public.teaching_logbook(teaching_date DESC);
CREATE INDEX IF NOT EXISTS idx_logbook_year_sem ON public.teaching_logbook(academic_year, semester);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teaching_logbook TO authenticated;
GRANT ALL ON public.teaching_logbook TO service_role;
ALTER TABLE public.teaching_logbook ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logbook_own_all" ON public.teaching_logbook;
DROP POLICY IF EXISTS "logbook_own_all" ON public.teaching_logbook;
CREATE POLICY "logbook_own_all" ON public.teaching_logbook FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "logbook_admin_view" ON public.teaching_logbook;
DROP POLICY IF EXISTS "logbook_admin_view" ON public.teaching_logbook;
CREATE POLICY "logbook_admin_view" ON public.teaching_logbook FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE OR REPLACE FUNCTION public.set_lesson_plan_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.teacher_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO NEW.teacher_id FROM public.personnel WHERE user_id = NEW.user_id LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lesson_plans_defaults ON public.lesson_plans;
CREATE TRIGGER trg_lesson_plans_defaults BEFORE INSERT OR UPDATE ON public.lesson_plans
FOR EACH ROW EXECUTE FUNCTION public.set_lesson_plan_defaults();

CREATE OR REPLACE FUNCTION public.set_logbook_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.teacher_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO NEW.teacher_id FROM public.personnel WHERE user_id = NEW.user_id LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_logbook_defaults ON public.teaching_logbook;
CREATE TRIGGER trg_logbook_defaults BEFORE INSERT OR UPDATE ON public.teaching_logbook
FOR EACH ROW EXECUTE FUNCTION public.set_logbook_defaults();

ALTER TABLE public.lesson_plans REPLICA IDENTITY FULL;
ALTER TABLE public.teaching_logbook REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='lesson_plans') THEN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'lesson_plans'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_plans;
      END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='teaching_logbook') THEN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'teaching_logbook'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.teaching_logbook;
      END IF;
  END IF;
END $$;

-- padlet_boards + padlet_notes
CREATE TABLE IF NOT EXISTS public.padlet_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  background text DEFAULT 'paper',
  layout text NOT NULL DEFAULT 'grid',
  is_public boolean NOT NULL DEFAULT false,
  allow_guest_post boolean NOT NULL DEFAULT true,
  share_code text UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.padlet_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.padlet_boards(id) ON DELETE CASCADE,
  author_id uuid,
  author_name text,
  content text,
  color text DEFAULT 'yellow',
  image_url text,
  link_url text,
  position integer NOT NULL DEFAULT 0,
  column_key text,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_padlet_notes_board ON public.padlet_notes(board_id, position);
CREATE INDEX IF NOT EXISTS idx_padlet_boards_owner ON public.padlet_boards(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.padlet_boards TO authenticated;
GRANT ALL ON public.padlet_boards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.padlet_notes TO authenticated;
GRANT ALL ON public.padlet_notes TO service_role;

ALTER TABLE public.padlet_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.padlet_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boards viewable by authenticated" ON public.padlet_boards;
DROP POLICY IF EXISTS "boards viewable by authenticated" ON public.padlet_boards;
CREATE POLICY "boards viewable by authenticated" ON public.padlet_boards FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "teachers can create boards" ON public.padlet_boards;
DROP POLICY IF EXISTS "teachers can create boards" ON public.padlet_boards;
CREATE POLICY "teachers can create boards" ON public.padlet_boards FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id AND (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')));
DROP POLICY IF EXISTS "owners or admins update boards" ON public.padlet_boards;
DROP POLICY IF EXISTS "owners or admins update boards" ON public.padlet_boards;
CREATE POLICY "owners or admins update boards" ON public.padlet_boards FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
DROP POLICY IF EXISTS "owners or admins delete boards" ON public.padlet_boards;
DROP POLICY IF EXISTS "owners or admins delete boards" ON public.padlet_boards;
CREATE POLICY "owners or admins delete boards" ON public.padlet_boards FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "notes viewable by authenticated" ON public.padlet_notes;
DROP POLICY IF EXISTS "notes viewable by authenticated" ON public.padlet_notes;
CREATE POLICY "notes viewable by authenticated" ON public.padlet_notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can post notes" ON public.padlet_notes;
DROP POLICY IF EXISTS "authenticated can post notes" ON public.padlet_notes;
CREATE POLICY "authenticated can post notes" ON public.padlet_notes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.padlet_boards b WHERE b.id = board_id AND (b.allow_guest_post = true OR b.owner_id = auth.uid())));
DROP POLICY IF EXISTS "authors or board owners update notes" ON public.padlet_notes;
DROP POLICY IF EXISTS "authors or board owners update notes" ON public.padlet_notes;
CREATE POLICY "authors or board owners update notes" ON public.padlet_notes FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.padlet_boards b WHERE b.id = board_id AND b.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
DROP POLICY IF EXISTS "authors or board owners delete notes" ON public.padlet_notes;
DROP POLICY IF EXISTS "authors or board owners delete notes" ON public.padlet_notes;
CREATE POLICY "authors or board owners delete notes" ON public.padlet_notes FOR DELETE TO authenticated
USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.padlet_boards b WHERE b.id = board_id AND b.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- upstream_subscription
CREATE TABLE IF NOT EXISTS public.upstream_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'default',
  bundle_url text NOT NULL,
  auto_pull boolean NOT NULL DEFAULT true,
  last_version text,
  last_pulled_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upstream_subscription TO authenticated;
GRANT ALL ON public.upstream_subscription TO service_role;
ALTER TABLE public.upstream_subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage upstream subscription" ON public.upstream_subscription;
DROP POLICY IF EXISTS "Admins manage upstream subscription" ON public.upstream_subscription;
CREATE POLICY "Admins manage upstream subscription" ON public.upstream_subscription FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP TRIGGER IF EXISTS trg_upstream_subscription_updated ON public.upstream_subscription;
CREATE TRIGGER trg_upstream_subscription_updated BEFORE UPDATE ON public.upstream_subscription
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
