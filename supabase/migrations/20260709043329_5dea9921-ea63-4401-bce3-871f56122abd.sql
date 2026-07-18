
-- ============================================
-- 1) lesson_plans — แผนการจัดการเรียนรู้
-- ============================================
CREATE TABLE public.lesson_plans (
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

CREATE INDEX idx_lesson_plans_user ON public.lesson_plans(user_id);
CREATE INDEX idx_lesson_plans_teacher ON public.lesson_plans(teacher_id);
CREATE INDEX idx_lesson_plans_year_sem ON public.lesson_plans(academic_year, semester);
CREATE INDEX idx_lesson_plans_subject ON public.lesson_plans(subject_id);
CREATE INDEX idx_lesson_plans_status ON public.lesson_plans(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plans TO authenticated;
GRANT ALL ON public.lesson_plans TO service_role;

ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

-- Teachers manage their own plans
CREATE POLICY "lesson_plans_own_select" ON public.lesson_plans
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "lesson_plans_own_insert" ON public.lesson_plans
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "lesson_plans_own_update" ON public.lesson_plans
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status <> 'approved')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lesson_plans_own_delete" ON public.lesson_plans
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft','revise_needed'));

-- Admin/director: full access (view all + supervise)
CREATE POLICY "lesson_plans_admin_all" ON public.lesson_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- Peers: view approved plans of colleagues (PLC sharing)
CREATE POLICY "lesson_plans_peer_view_approved" ON public.lesson_plans
  FOR SELECT TO authenticated
  USING (status = 'approved');

-- ============================================
-- 2) teaching_logbook — บันทึกการสอนรายวัน
-- ============================================
CREATE TABLE public.teaching_logbook (
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

CREATE INDEX idx_logbook_user ON public.teaching_logbook(user_id);
CREATE INDEX idx_logbook_teacher ON public.teaching_logbook(teacher_id);
CREATE INDEX idx_logbook_date ON public.teaching_logbook(teaching_date DESC);
CREATE INDEX idx_logbook_year_sem ON public.teaching_logbook(academic_year, semester);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teaching_logbook TO authenticated;
GRANT ALL ON public.teaching_logbook TO service_role;

ALTER TABLE public.teaching_logbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logbook_own_all" ON public.teaching_logbook
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "logbook_admin_view" ON public.teaching_logbook
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- ============================================
-- 3) Auto-update updated_at + auto teacher_id
-- ============================================
CREATE OR REPLACE FUNCTION public.set_lesson_plan_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.teacher_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO NEW.teacher_id FROM public.personnel WHERE user_id = NEW.user_id LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_lesson_plans_defaults
  BEFORE INSERT OR UPDATE ON public.lesson_plans
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

CREATE TRIGGER trg_logbook_defaults
  BEFORE INSERT OR UPDATE ON public.teaching_logbook
  FOR EACH ROW EXECUTE FUNCTION public.set_logbook_defaults();

-- ============================================
-- 4) Realtime
-- ============================================
ALTER TABLE public.lesson_plans REPLICA IDENTITY FULL;
ALTER TABLE public.teaching_logbook REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teaching_logbook;
