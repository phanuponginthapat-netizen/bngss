
-- exams
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  topic TEXT,
  level TEXT NOT NULL DEFAULT 'medium',
  question_count INT NOT NULL DEFAULT 20,
  reference_sources JSONB NOT NULL DEFAULT '["onet"]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  academic_year INT,
  semester INT,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exam owner read" ON public.exams;
DROP POLICY IF EXISTS "exam owner read" ON public.exams;
CREATE POLICY "exam owner read" ON public.exams FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "exam owner write" ON public.exams;
DROP POLICY IF EXISTS "exam owner write" ON public.exams;
CREATE POLICY "exam owner write" ON public.exams FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- exam_questions
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_no INT NOT NULL,
  question_text TEXT NOT NULL,
  choices JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  bloom_level TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, question_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated;
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exam_questions via exam" ON public.exam_questions;
DROP POLICY IF EXISTS "exam_questions via exam" ON public.exam_questions;
CREATE POLICY "exam_questions via exam" ON public.exam_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND (e.teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND (e.teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- exam_sheets
CREATE TABLE IF NOT EXISTS public.exam_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  sheet_code TEXT,
  layout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  student_code_digits INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_sheets TO authenticated;
GRANT ALL ON public.exam_sheets TO service_role;
ALTER TABLE public.exam_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exam_sheets via exam" ON public.exam_sheets;
DROP POLICY IF EXISTS "exam_sheets via exam" ON public.exam_sheets;
CREATE POLICY "exam_sheets via exam" ON public.exam_sheets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND (e.teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND (e.teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- exam_submissions
CREATE TABLE IF NOT EXISTS public.exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  student_code_detected TEXT,
  student_name_snapshot TEXT,
  scan_image_url TEXT,
  graded_image_url TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  correct_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC(6,2) NOT NULL DEFAULT 0,
  total NUMERIC(6,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  graded_by UUID REFERENCES auth.users(id),
  graded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_submissions TO authenticated;
GRANT ALL ON public.exam_submissions TO service_role;
ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exam_submissions teacher" ON public.exam_submissions;
DROP POLICY IF EXISTS "exam_submissions teacher" ON public.exam_submissions;
CREATE POLICY "exam_submissions teacher" ON public.exam_submissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND (e.teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND (e.teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
DROP POLICY IF EXISTS "exam_submissions student own" ON public.exam_submissions;
DROP POLICY IF EXISTS "exam_submissions student own" ON public.exam_submissions;
CREATE POLICY "exam_submissions student own" ON public.exam_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.auth_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_exams_teacher ON public.exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON public.exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam ON public.exam_submissions(exam_id);

DROP TRIGGER IF EXISTS trg_exams_updated ON public.exams;
CREATE TRIGGER trg_exams_updated BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
