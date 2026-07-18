
-- Reports: allow students to view their own via profile.student_code fallback
DROP POLICY IF EXISTS "Students view their own incomplete grade reports" ON public.incomplete_grade_reports;
CREATE POLICY "Students view their own incomplete grade reports"
ON public.incomplete_grade_reports FOR SELECT
USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.auth_user_id = auth.uid()
       OR s.student_code = (SELECT p.student_code FROM public.profiles p WHERE p.id = auth.uid())
  )
);

-- Fix requests: same fallback for students
DROP POLICY IF EXISTS "Students manage their own fix requests" ON public.incomplete_grade_fix_requests;
CREATE POLICY "Students manage their own fix requests"
ON public.incomplete_grade_fix_requests FOR ALL
USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.auth_user_id = auth.uid()
       OR s.student_code = (SELECT p.student_code FROM public.profiles p WHERE p.id = auth.uid())
  )
)
WITH CHECK (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.auth_user_id = auth.uid()
       OR s.student_code = (SELECT p.student_code FROM public.profiles p WHERE p.id = auth.uid())
  )
);
