CREATE TABLE IF NOT EXISTS public.mental_health_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid,
  tool text NOT NULL CHECK (tool IN ('2Q','9Q','8Q','ST5')),
  assessor_type text NOT NULL DEFAULT 'self' CHECK (assessor_type IN ('self','teacher','parent')),
  assessed_by uuid,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_score integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'normal',
  interpretation text,
  recommendation text,
  followed_up boolean NOT NULL DEFAULT false,
  follow_up_note text,
  academic_year integer,
  semester smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mha_student ON public.mental_health_assessments(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mha_risk ON public.mental_health_assessments(risk_level);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mental_health_assessments TO authenticated;
GRANT ALL ON public.mental_health_assessments TO service_role;

ALTER TABLE public.mental_health_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students view own mental health" ON public.mental_health_assessments;
CREATE POLICY "Students view own mental health" ON public.mental_health_assessments FOR SELECT TO authenticated
USING (student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid()));
DROP POLICY IF EXISTS "Students insert own mental health" ON public.mental_health_assessments;
CREATE POLICY "Students insert own mental health" ON public.mental_health_assessments FOR INSERT TO authenticated
WITH CHECK (assessor_type = 'self' AND student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid()));
DROP POLICY IF EXISTS "Parents view child mental health" ON public.mental_health_assessments;
CREATE POLICY "Parents view child mental health" ON public.mental_health_assessments FOR SELECT TO authenticated
USING (student_id = ANY (public.parent_child_ids(auth.uid())));
DROP POLICY IF EXISTS "Parents insert child mental health" ON public.mental_health_assessments;
CREATE POLICY "Parents insert child mental health" ON public.mental_health_assessments FOR INSERT TO authenticated
WITH CHECK (assessor_type = 'parent' AND student_id = ANY (public.parent_child_ids(auth.uid())));
DROP POLICY IF EXISTS "Staff view mental health" ON public.mental_health_assessments;
CREATE POLICY "Staff view mental health" ON public.mental_health_assessments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "Staff insert mental health" ON public.mental_health_assessments;
CREATE POLICY "Staff insert mental health" ON public.mental_health_assessments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "Staff update mental health" ON public.mental_health_assessments;
CREATE POLICY "Staff update mental health" ON public.mental_health_assessments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "Admins delete mental health" ON public.mental_health_assessments;
CREATE POLICY "Admins delete mental health" ON public.mental_health_assessments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.mental_health_assessments;
CREATE POLICY "school_scope_restrictive" ON public.mental_health_assessments AS RESTRICTIVE FOR ALL TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
WITH CHECK (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));

DROP TRIGGER IF EXISTS trg_mha_updated_at ON public.mental_health_assessments;
CREATE TRIGGER trg_mha_updated_at BEFORE UPDATE ON public.mental_health_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.career_aptitude_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid,
  assessor_type text NOT NULL DEFAULT 'self' CHECK (assessor_type IN ('self','teacher','parent')),
  assessed_by uuid,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_areas text[] NOT NULL DEFAULT '{}',
  suggested_careers text[] NOT NULL DEFAULT '{}',
  note text,
  academic_year integer,
  semester smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_student ON public.career_aptitude_assessments(student_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_aptitude_assessments TO authenticated;
GRANT ALL ON public.career_aptitude_assessments TO service_role;

ALTER TABLE public.career_aptitude_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students view own career" ON public.career_aptitude_assessments;
CREATE POLICY "Students view own career" ON public.career_aptitude_assessments FOR SELECT TO authenticated
USING (student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid()));
DROP POLICY IF EXISTS "Students insert own career" ON public.career_aptitude_assessments;
CREATE POLICY "Students insert own career" ON public.career_aptitude_assessments FOR INSERT TO authenticated
WITH CHECK (assessor_type = 'self' AND student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid()));
DROP POLICY IF EXISTS "Parents view child career" ON public.career_aptitude_assessments;
CREATE POLICY "Parents view child career" ON public.career_aptitude_assessments FOR SELECT TO authenticated
USING (student_id = ANY (public.parent_child_ids(auth.uid())));
DROP POLICY IF EXISTS "Staff view career" ON public.career_aptitude_assessments;
CREATE POLICY "Staff view career" ON public.career_aptitude_assessments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "Staff insert career" ON public.career_aptitude_assessments;
CREATE POLICY "Staff insert career" ON public.career_aptitude_assessments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "Staff update career" ON public.career_aptitude_assessments;
CREATE POLICY "Staff update career" ON public.career_aptitude_assessments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "Admins delete career" ON public.career_aptitude_assessments;
CREATE POLICY "Admins delete career" ON public.career_aptitude_assessments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.career_aptitude_assessments;
CREATE POLICY "school_scope_restrictive" ON public.career_aptitude_assessments AS RESTRICTIVE FOR ALL TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
WITH CHECK (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));

DROP TRIGGER IF EXISTS trg_career_updated_at ON public.career_aptitude_assessments;
CREATE TRIGGER trg_career_updated_at BEFORE UPDATE ON public.career_aptitude_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_mha_school ON public.mental_health_assessments;
CREATE TRIGGER trg_mha_school BEFORE INSERT ON public.mental_health_assessments
FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id();
DROP TRIGGER IF EXISTS trg_career_school ON public.career_aptitude_assessments;
CREATE TRIGGER trg_career_school BEFORE INSERT ON public.career_aptitude_assessments
FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id();