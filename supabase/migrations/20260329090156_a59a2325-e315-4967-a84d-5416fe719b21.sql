
-- Teacher assignments (admin assigns subjects to teachers with classrooms)
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  academic_year INTEGER DEFAULT EXTRACT(year FROM now()),
  semester INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(personnel_id, subject_id, classroom_id, academic_year, semester)
);

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users manage teacher_assignments" ON public.teacher_assignments;
CREATE POLICY "Auth users manage teacher_assignments" ON public.teacher_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Assessment criteria (admin-defined topics for competency, desirable characteristics, reading/thinking/writing)
CREATE TABLE IF NOT EXISTS public.assessment_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'competency',
  title TEXT NOT NULL,
  description TEXT,
  academic_year INTEGER DEFAULT EXTRACT(year FROM now()),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assessment_criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users manage assessment_criteria" ON public.assessment_criteria;
CREATE POLICY "Auth users manage assessment_criteria" ON public.assessment_criteria
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Student assessment scores
CREATE TABLE IF NOT EXISTS public.student_assessment_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  criteria_id UUID REFERENCES public.assessment_criteria(id) ON DELETE CASCADE NOT NULL,
  score INTEGER DEFAULT 0,
  level TEXT DEFAULT 'moderate',
  semester INTEGER DEFAULT 1,
  academic_year INTEGER DEFAULT EXTRACT(year FROM now()),
  assessed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, criteria_id, semester, academic_year)
);

ALTER TABLE public.student_assessment_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users manage student_assessment_scores" ON public.student_assessment_scores;
CREATE POLICY "Auth users manage student_assessment_scores" ON public.student_assessment_scores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Subject indicators (teacher-defined per subject)
CREATE TABLE IF NOT EXISTS public.subject_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subject_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users manage subject_indicators" ON public.subject_indicators;
CREATE POLICY "Auth users manage subject_indicators" ON public.subject_indicators
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Score columns (teacher-defined score structure per subject)
CREATE TABLE IF NOT EXISTS public.subject_score_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
  column_name TEXT NOT NULL,
  column_type TEXT NOT NULL DEFAULT 'assignment',
  max_score NUMERIC NOT NULL DEFAULT 10,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subject_score_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users manage subject_score_columns" ON public.subject_score_columns;
CREATE POLICY "Auth users manage subject_score_columns" ON public.subject_score_columns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Student column scores (individual scores per column per student)
CREATE TABLE IF NOT EXISTS public.student_column_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  column_id UUID REFERENCES public.subject_score_columns(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, column_id)
);

ALTER TABLE public.student_column_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users manage student_column_scores" ON public.student_column_scores;
CREATE POLICY "Auth users manage student_column_scores" ON public.student_column_scores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
