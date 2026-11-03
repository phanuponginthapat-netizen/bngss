CREATE TABLE IF NOT EXISTS public.grade_remediation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_code text NOT NULL, subject_name text, term text NOT NULL, academic_year text,
  original_grade text NOT NULL CHECK (original_grade IN ('0','ร','มส','มผ')),
  reason text,
  status text NOT NULL DEFAULT 'ติด' CHECK (status IN ('ติด','ประกาศแล้ว','กำลังแก้','รอสอบแก้','ผ่าน','ไม่ผ่าน')),
  announced_at timestamptz, announcement_id uuid, fix_deadline date,
  fix_method text CHECK (fix_method IS NULL OR fix_method IN ('ส่งงาน','สอบแก้','เรียนซ่อม')),
  fix_score numeric, new_grade text, teacher_id uuid, reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), notes text,
  UNIQUE(student_id, subject_code, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_remediation TO authenticated;
GRANT ALL ON public.grade_remediation TO service_role;
ALTER TABLE public.grade_remediation ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_grade_remediation_student_id ON public.grade_remediation(student_id);
CREATE INDEX IF NOT EXISTS idx_grade_remediation_status ON public.grade_remediation(status);

CREATE TABLE IF NOT EXISTS public.remediation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remediation_id uuid NOT NULL REFERENCES public.grade_remediation(id) ON DELETE CASCADE,
  session_date date NOT NULL, score numeric,
  result text CHECK (result IS NULL OR result IN ('ผ่าน','ไม่ผ่าน','รอผล')),
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remediation_sessions TO authenticated;
GRANT ALL ON public.remediation_sessions TO service_role;
ALTER TABLE public.remediation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view grade_remediation" ON public.grade_remediation;
CREATE POLICY "Staff view grade_remediation" ON public.grade_remediation FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')
         OR student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));
DROP POLICY IF EXISTS "Staff manage grade_remediation" ON public.grade_remediation;
CREATE POLICY "Staff manage grade_remediation" ON public.grade_remediation FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "Staff manage remediation_sessions" ON public.remediation_sessions;
CREATE POLICY "Staff manage remediation_sessions" ON public.remediation_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

CREATE TABLE IF NOT EXISTS public.academic_probation (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year integer NOT NULL, semester integer NOT NULL, gpax numeric,
  status text DEFAULT 'at_risk' CHECK (status IN ('at_risk','warning','cleared','probation')),
  notes text, reviewed_by uuid,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_probation TO authenticated;
GRANT ALL ON public.academic_probation TO service_role;
ALTER TABLE public.academic_probation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view probation" ON public.academic_probation;
CREATE POLICY "Staff view probation" ON public.academic_probation FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "Admins manage probation" ON public.academic_probation;
CREATE POLICY "Admins manage probation" ON public.academic_probation FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  leave_type text NOT NULL,
  total_days numeric DEFAULT 0, used_days numeric DEFAULT 0,
  remaining_days numeric GENERATED ALWAYS AS (total_days - used_days) STORED,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, year, leave_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own leave balances" ON public.leave_balances;
CREATE POLICY "Users view own leave balances" ON public.leave_balances FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins manage leave balances" ON public.leave_balances;
CREATE POLICY "Admins manage leave balances" ON public.leave_balances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text, background_url text,
  paper text NOT NULL DEFAULT 'A4', orientation text NOT NULL DEFAULT 'landscape',
  font_family text NOT NULL DEFAULT 'Sarabun', fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_templates TO authenticated;
GRANT ALL ON public.certificate_templates TO service_role;
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view certificate templates" ON public.certificate_templates;
CREATE POLICY "Staff view certificate templates" ON public.certificate_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "Staff manage certificate templates" ON public.certificate_templates;
CREATE POLICY "Staff manage certificate templates" ON public.certificate_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

CREATE OR REPLACE FUNCTION public.mark_overdue_homework_columns()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'director')) THEN
    RETURN 0;
  END IF;
  WITH updated AS (
    UPDATE public.student_column_scores scs SET status = 'overdue', score = 0
      FROM public.subject_score_columns col
      JOIN public.homework_assignments ha ON ha.id = col.homework_assignment_id
     WHERE scs.column_id = col.id AND scs.status = 'pending'
       AND ha.due_date IS NOT NULL AND ha.due_date < (now() AT TIME ZONE 'Asia/Bangkok')::date
    RETURNING scs.id)
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_homework_columns() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_overdue_homework_columns() TO authenticated;