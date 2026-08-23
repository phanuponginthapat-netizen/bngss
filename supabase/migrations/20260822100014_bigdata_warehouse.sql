-- BigData warehouse star schema: dims + facts for attendance/grades/finance
-- dims: dim_date, dim_student, dim_subject
-- facts: fact_attendance, fact_grades, fact_finance

-- ============================================================
-- DIM: dim_date
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dim_date (
  date date PRIMARY KEY,
  day int NOT NULL,
  month int NOT NULL,
  quarter int NOT NULL,
  is_holiday boolean NOT NULL DEFAULT false,
  academic_year text,
  semester int
);

COMMENT ON TABLE public.dim_date IS 'Warehouse date dimension 2024-2030, is_holiday via public.is_holiday(date), academic_year/semester for Thai school year';
COMMENT ON COLUMN public.dim_date.date IS 'PK, calendar date';
COMMENT ON COLUMN public.dim_date.is_holiday IS 'true if public.is_holiday(date)';
COMMENT ON COLUMN public.dim_date.academic_year IS 'Thai academic year e.g. 2024 = May 2024 - Apr 2025';
COMMENT ON COLUMN public.dim_date.semester IS '1=May-Oct, 2=Nov-Apr';

-- ============================================================
-- DIM: dim_student (SCD1 snapshot)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dim_student (
  student_id uuid PRIMARY KEY,
  student_code text,
  full_name text,
  grade_level text,
  classroom text,
  status text
);

COMMENT ON TABLE public.dim_student IS 'Student dimension for warehouse — denormalized from public.students';

-- ============================================================
-- DIM: dim_subject
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dim_subject (
  subject_id uuid PRIMARY KEY,
  code text,
  name_th text,
  credits int
);

COMMENT ON TABLE public.dim_subject IS 'Subject dimension for warehouse';

-- ============================================================
-- FACT: fact_attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fact_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL REFERENCES public.dim_date(date),
  student_id uuid REFERENCES public.dim_student(student_id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.dim_subject(subject_id) ON DELETE SET NULL,
  status text,
  scan_method text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fact_attendance IS 'Grain: one row per student/day/subject attendance scan';
COMMENT ON COLUMN public.fact_attendance.status IS 'present/absent/late/leave etc';
COMMENT ON COLUMN public.fact_attendance.scan_method IS 'face/qr/manual etc';

-- ============================================================
-- FACT: fact_grades
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fact_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL REFERENCES public.dim_date(date),
  student_id uuid REFERENCES public.dim_student(student_id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.dim_subject(subject_id) ON DELETE SET NULL,
  score numeric,
  grade text,
  grade_point numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fact_grades IS 'Grain: one row per student/subject/assessment date';
COMMENT ON COLUMN public.fact_grades.grade IS 'A/B+/etc';
COMMENT ON COLUMN public.fact_grades.grade_point IS '4.0/3.5 etc';

-- ============================================================
-- FACT: fact_finance (budget + petty cash)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fact_finance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL REFERENCES public.dim_date(date),
  type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fact_finance IS 'Grain: one row per finance transaction (budget/petty)';
COMMENT ON COLUMN public.fact_finance.type IS 'budget or petty';
COMMENT ON COLUMN public.fact_finance.category IS 'income/expense category';

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fact_attendance_date ON public.fact_attendance(date);
CREATE INDEX IF NOT EXISTS idx_fact_attendance_student_id ON public.fact_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_fact_attendance_subject_id ON public.fact_attendance(subject_id);
CREATE INDEX IF NOT EXISTS idx_fact_attendance_date_student ON public.fact_attendance(date, student_id);

CREATE INDEX IF NOT EXISTS idx_fact_grades_date ON public.fact_grades(date);
CREATE INDEX IF NOT EXISTS idx_fact_grades_student_id ON public.fact_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_fact_grades_subject_id ON public.fact_grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_fact_grades_date_student ON public.fact_grades(date, student_id);

CREATE INDEX IF NOT EXISTS idx_fact_finance_date ON public.fact_finance(date);
CREATE INDEX IF NOT EXISTS idx_fact_finance_type ON public.fact_finance(type);
CREATE INDEX IF NOT EXISTS idx_fact_finance_category ON public.fact_finance(category);

CREATE INDEX IF NOT EXISTS idx_dim_date_academic_year ON public.dim_date(academic_year);
CREATE INDEX IF NOT EXISTS idx_dim_date_semester ON public.dim_date(semester);

-- ============================================================
-- RLS: authenticated true (warehouse is read for analytics)
-- ============================================================
ALTER TABLE public.dim_date ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_student ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_subject ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_finance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view dim_date" ON public.dim_date;
CREATE POLICY "Authenticated can view dim_date" ON public.dim_date FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage dim_date" ON public.dim_date;
CREATE POLICY "Authenticated can manage dim_date" ON public.dim_date FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can view dim_student" ON public.dim_student;
CREATE POLICY "Authenticated can view dim_student" ON public.dim_student FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage dim_student" ON public.dim_student;
CREATE POLICY "Authenticated can manage dim_student" ON public.dim_student FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can view dim_subject" ON public.dim_subject;
CREATE POLICY "Authenticated can view dim_subject" ON public.dim_subject FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage dim_subject" ON public.dim_subject;
CREATE POLICY "Authenticated can manage dim_subject" ON public.dim_subject FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can view fact_attendance" ON public.fact_attendance;
CREATE POLICY "Authenticated can view fact_attendance" ON public.fact_attendance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage fact_attendance" ON public.fact_attendance;
CREATE POLICY "Authenticated can manage fact_attendance" ON public.fact_attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can view fact_grades" ON public.fact_grades;
CREATE POLICY "Authenticated can view fact_grades" ON public.fact_grades FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage fact_grades" ON public.fact_grades;
CREATE POLICY "Authenticated can manage fact_grades" ON public.fact_grades FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can view fact_finance" ON public.fact_finance;
CREATE POLICY "Authenticated can view fact_finance" ON public.fact_finance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage fact_finance" ON public.fact_finance;
CREATE POLICY "Authenticated can manage fact_finance" ON public.fact_finance FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT ON public.dim_date TO authenticated;
GRANT SELECT ON public.dim_student TO authenticated;
GRANT SELECT ON public.dim_subject TO authenticated;
GRANT SELECT ON public.fact_attendance TO authenticated;
GRANT SELECT ON public.fact_grades TO authenticated;
GRANT SELECT ON public.fact_finance TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dim_date TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dim_student TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dim_subject TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fact_attendance TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fact_grades TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fact_finance TO authenticated;

-- ============================================================
-- POPULATE dim_date 2024-2030 via generate_series
-- is_holiday via public.is_holiday(date) when available
-- ============================================================
INSERT INTO public.dim_date (date, day, month, quarter, is_holiday, academic_year, semester)
SELECT
  d::date AS date,
  EXTRACT(DAY FROM d)::int AS day,
  EXTRACT(MONTH FROM d)::int AS month,
  EXTRACT(QUARTER FROM d)::int AS quarter,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_holiday' AND pronamespace = 'public'::regnamespace)
    THEN public.is_holiday(d::date)
    ELSE false
  END AS is_holiday,
  CASE WHEN EXTRACT(MONTH FROM d) >= 5 THEN EXTRACT(YEAR FROM d)::text ELSE (EXTRACT(YEAR FROM d) - 1)::text END AS academic_year,
  CASE WHEN EXTRACT(MONTH FROM d) BETWEEN 5 AND 10 THEN 1 ELSE 2 END AS semester
FROM generate_series('2024-01-01'::date, '2030-12-31'::date, '1 day'::interval) d
ON CONFLICT (date) DO UPDATE SET
  day = EXCLUDED.day,
  month = EXCLUDED.month,
  quarter = EXCLUDED.quarter,
  is_holiday = EXCLUDED.is_holiday,
  academic_year = EXCLUDED.academic_year,
  semester = EXCLUDED.semester;
