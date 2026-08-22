-- Grade remediation system: 0 ร มส มผ tracking, announce, fix, retake
-- Tables: grade_remediation, remediation_sessions

-- Ensure students table exists before FK (it does in base schema)
-- 1) grade_remediation
CREATE TABLE IF NOT EXISTS public.grade_remediation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_code text NOT NULL,
  subject_name text,
  term text NOT NULL, -- e.g. "1/2568"
  academic_year text,
  original_grade text NOT NULL CHECK (original_grade IN ('0','ร','มส','มผ')),
  reason text,
  status text NOT NULL DEFAULT 'ติด' CHECK (status IN ('ติด','ประกาศแล้ว','กำลังแก้','รอสอบแก้','ผ่าน','ไม่ผ่าน')),
  announced_at timestamptz,
  announcement_id uuid,
  fix_deadline date,
  fix_method text CHECK (fix_method IS NULL OR fix_method IN ('ส่งงาน','สอบแก้','เรียนซ่อม')),
  fix_score numeric,
  new_grade text,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(student_id, subject_code, term)
);

-- 2) remediation_sessions for retake exams
CREATE TABLE IF NOT EXISTS public.remediation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remediation_id uuid NOT NULL REFERENCES public.grade_remediation(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  score numeric,
  result text CHECK (result IS NULL OR result IN ('ผ่าน','ไม่ผ่าน','รอผล')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Updated at trigger for grade_remediation
CREATE OR REPLACE FUNCTION public.set_grade_remediation_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grade_remediation_updated_at ON public.grade_remediation;
CREATE TRIGGER trg_grade_remediation_updated_at
  BEFORE UPDATE ON public.grade_remediation
  FOR EACH ROW EXECUTE FUNCTION public.set_grade_remediation_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grade_remediation_student_id ON public.grade_remediation(student_id);
CREATE INDEX IF NOT EXISTS idx_grade_remediation_status ON public.grade_remediation(status);
CREATE INDEX IF NOT EXISTS idx_grade_remediation_term ON public.grade_remediation(term);
CREATE INDEX IF NOT EXISTS idx_grade_remediation_academic_year ON public.grade_remediation(academic_year);
CREATE INDEX IF NOT EXISTS idx_grade_remediation_subject_code ON public.grade_remediation(subject_code);
CREATE INDEX IF NOT EXISTS idx_grade_remediation_teacher_id ON public.grade_remediation(teacher_id);
CREATE INDEX IF NOT EXISTS idx_remediation_sessions_remediation_id ON public.remediation_sessions(remediation_id);
CREATE INDEX IF NOT EXISTS idx_remediation_sessions_date ON public.remediation_sessions(session_date);

-- RLS
ALTER TABLE public.grade_remediation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_sessions ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated can read
DROP POLICY IF EXISTS "Authenticated can view grade_remediation" ON public.grade_remediation;
CREATE POLICY "Authenticated can view grade_remediation"
  ON public.grade_remediation FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Teachers and admins can manage grade_remediation" ON public.grade_remediation;
CREATE POLICY "Teachers and admins can manage grade_remediation"
  ON public.grade_remediation FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','director','teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','director','teacher')
    )
  );

-- Allow students to view own remediation (optional, friendly)
DROP POLICY IF EXISTS "Students can view own remediation" ON public.grade_remediation;
CREATE POLICY "Students can view own remediation"
  ON public.grade_remediation FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated can view remediation_sessions" ON public.remediation_sessions;
CREATE POLICY "Authenticated can view remediation_sessions"
  ON public.remediation_sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Teachers and admins can manage remediation_sessions" ON public.remediation_sessions;
CREATE POLICY "Teachers and admins can manage remediation_sessions"
  ON public.remediation_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','director','teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','director','teacher')
    )
  );

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_remediation TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remediation_sessions TO authenticated;

COMMENT ON TABLE public.grade_remediation IS 'ระบบติด 0 ร มส มผ — ติดตาม ประกาศ แก้ไข สอบแก้ (term=1/2568, status=ติด/ประกาศแล้ว/กำลังแก้/รอสอบแก้/ผ่าน/ไม่ผ่าน)';
COMMENT ON COLUMN public.grade_remediation.original_grade IS 'เกรดเดิม: 0=failed, ร=pending, มส=ไม่ส่งงาน, มผ=ไม่ผ่านกิจกรรม';
COMMENT ON COLUMN public.grade_remediation.status IS 'ติด=เริ่มต้น, ประกาศแล้ว=announced, กำลังแก้=fixing, รอสอบแก้=await retake, ผ่าน/ไม่ผ่าน=final';
COMMENT ON TABLE public.remediation_sessions IS 'รอบสอบแก้/แก้ตัว รายครั้ง ผูกกับ grade_remediation';
