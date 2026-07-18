
CREATE TYPE public.incomplete_grade_fix_status AS ENUM ('pending','accepted','assigned','completed','rejected');

CREATE TABLE public.incomplete_grade_fix_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid REFERENCES public.incomplete_grade_reports(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL,
  grade_type public.incomplete_grade_type NOT NULL,
  student_note text,
  status public.incomplete_grade_fix_status NOT NULL DEFAULT 'pending',
  assigned_task text,
  exam_date timestamptz,
  exam_location text,
  teacher_note text,
  academic_year integer NOT NULL,
  semester integer NOT NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_igfr_student ON public.incomplete_grade_fix_requests(student_id);
CREATE INDEX idx_igfr_teacher ON public.incomplete_grade_fix_requests(teacher_id);
CREATE INDEX idx_igfr_status ON public.incomplete_grade_fix_requests(status);
CREATE INDEX idx_igfr_year_sem ON public.incomplete_grade_fix_requests(academic_year, semester);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incomplete_grade_fix_requests TO authenticated;
GRANT ALL ON public.incomplete_grade_fix_requests TO service_role;

ALTER TABLE public.incomplete_grade_fix_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Director manage all fix requests"
ON public.incomplete_grade_fix_requests
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE POLICY "Students manage their own fix requests"
ON public.incomplete_grade_fix_requests
FOR ALL TO authenticated
USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()))
WITH CHECK (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));

CREATE POLICY "Teachers view & respond fix requests targeting them"
ON public.incomplete_grade_fix_requests
FOR ALL TO authenticated
USING (teacher_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()))
WITH CHECK (teacher_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()));

CREATE TRIGGER trg_igfr_updated_at
BEFORE UPDATE ON public.incomplete_grade_fix_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.incomplete_grade_fix_requests;
ALTER TABLE public.incomplete_grade_fix_requests REPLICA IDENTITY FULL;
