-- Create classrooms table
CREATE TABLE IF NOT EXISTS public.classrooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- e.g. 'ม.1/1', 'ป.3/2'
  grade_level TEXT NOT NULL, -- e.g. 'ม.1', 'ป.3'
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  homeroom_teacher TEXT,
  capacity INTEGER DEFAULT 40,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_code TEXT NOT NULL UNIQUE,
  prefix TEXT DEFAULT 'ด.ช.',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create enrollments table (linking students to subjects)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  semester INTEGER CHECK (semester IN (1, 2)),
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  enrollment_type TEXT NOT NULL DEFAULT 'individual' CHECK (enrollment_type IN ('individual', 'classroom')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed')),
  UNIQUE (student_id, subject_id, semester, academic_year)
);

-- Enable RLS
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
DROP POLICY IF EXISTS "Auth users can manage classrooms" ON public.classrooms;
CREATE POLICY "Auth users can manage classrooms" ON public.classrooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth users can manage students" ON public.students;
CREATE POLICY "Auth users can manage students" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth users can manage enrollments" ON public.enrollments;
CREATE POLICY "Auth users can manage enrollments" ON public.enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Triggers
CREATE TRIGGER update_classrooms_updated_at BEFORE UPDATE ON public.classrooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_students_classroom ON public.students(classroom_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON public.enrollments(subject_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_classroom ON public.enrollments(classroom_id);
