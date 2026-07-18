
DO $$ BEGIN
  CREATE TYPE public.incomplete_grade_type AS ENUM ('0', 'ร', 'มส');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.incomplete_grade_status AS ENUM ('pending', 'resolved', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.incomplete_grade_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  grade_type public.incomplete_grade_type NOT NULL,
  reason TEXT,
  academic_year INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  status public.incomplete_grade_status NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_igr_student ON public.incomplete_grade_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_igr_subject ON public.incomplete_grade_reports(subject_id);
CREATE INDEX IF NOT EXISTS idx_igr_teacher ON public.incomplete_grade_reports(teacher_id);
CREATE INDEX IF NOT EXISTS idx_igr_year_sem ON public.incomplete_grade_reports(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_igr_status ON public.incomplete_grade_reports(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incomplete_grade_reports TO authenticated;
GRANT ALL ON public.incomplete_grade_reports TO service_role;

ALTER TABLE public.incomplete_grade_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Director manage all incomplete grades"
ON public.incomplete_grade_reports
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Teachers manage their own incomplete grade reports"
ON public.incomplete_grade_reports
FOR ALL TO authenticated
USING (
  reported_by = auth.uid()
  OR teacher_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
)
WITH CHECK (
  reported_by = auth.uid()
  OR teacher_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
);

CREATE POLICY "Students view their own incomplete grade reports"
ON public.incomplete_grade_reports
FOR SELECT TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.update_incomplete_grade_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_igr_updated_at ON public.incomplete_grade_reports;
CREATE TRIGGER trg_igr_updated_at
BEFORE UPDATE ON public.incomplete_grade_reports
FOR EACH ROW EXECUTE FUNCTION public.update_incomplete_grade_updated_at();

ALTER TABLE public.incomplete_grade_reports REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.incomplete_grade_reports;
EXCEPTION WHEN duplicate_object THEN null; END $$;
