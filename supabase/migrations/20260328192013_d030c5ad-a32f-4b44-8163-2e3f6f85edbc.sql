-- Create subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_th TEXT NOT NULL,
  name_en TEXT,
  credits NUMERIC(3,1) NOT NULL DEFAULT 1.0,
  subject_type TEXT NOT NULL DEFAULT 'required' CHECK (subject_type IN ('required', 'elective', 'activity')),
  grade_level TEXT,
  semester INTEGER CHECK (semester IN (1, 2)),
  academic_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create student_scores table
CREATE TABLE IF NOT EXISTS public.student_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_code TEXT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  midterm_score NUMERIC(5,2) DEFAULT 0,
  final_score NUMERIC(5,2) DEFAULT 0,
  assignment_score NUMERIC(5,2) DEFAULT 0,
  attendance_score NUMERIC(5,2) DEFAULT 0,
  total_score NUMERIC(5,2) GENERATED ALWAYS AS (
    COALESCE(midterm_score, 0) + COALESCE(final_score, 0) + COALESCE(assignment_score, 0) + COALESCE(attendance_score, 0)
  ) STORED,
  grade TEXT,
  grade_point NUMERIC(3,1),
  semester INTEGER CHECK (semester IN (1, 2)),
  academic_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON public.subjects;
CREATE POLICY "Authenticated users can view subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert subjects" ON public.subjects;
CREATE POLICY "Authenticated users can insert subjects" ON public.subjects FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update subjects" ON public.subjects;
CREATE POLICY "Authenticated users can update subjects" ON public.subjects FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can delete subjects" ON public.subjects;
CREATE POLICY "Authenticated users can delete subjects" ON public.subjects FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view scores" ON public.student_scores;
CREATE POLICY "Authenticated users can view scores" ON public.student_scores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert scores" ON public.student_scores;
CREATE POLICY "Authenticated users can insert scores" ON public.student_scores FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update scores" ON public.student_scores;
CREATE POLICY "Authenticated users can update scores" ON public.student_scores FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can delete scores" ON public.student_scores;
CREATE POLICY "Authenticated users can delete scores" ON public.student_scores FOR DELETE TO authenticated USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_student_scores_updated_at BEFORE UPDATE ON public.student_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
