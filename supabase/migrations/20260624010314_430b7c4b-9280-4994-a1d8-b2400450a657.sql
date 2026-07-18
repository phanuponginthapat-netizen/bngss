-- Allow all teachers to VIEW all incomplete grade reports & fix requests (read-only follow-up)
-- Write/edit remains restricted to owner teacher + admin/director by existing policies.

CREATE POLICY "Teachers view all incomplete grade reports"
ON public.incomplete_grade_reports
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers view all fix requests"
ON public.incomplete_grade_fix_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role));