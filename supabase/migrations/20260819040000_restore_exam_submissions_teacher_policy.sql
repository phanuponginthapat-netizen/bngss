-- Restore teacher-owner/admin/director write access to exam_submissions.
-- dept_member_* policies (created ad-hoc, not in repo) currently restrict INSERT
-- to academic dept members only — blocking exam grading by the owning teacher,
-- admin, or director who is not a dept member. Add an additive permissive
-- policy so either path grants access (RLS permissive policies are OR-ed).
DO $guard$
DECLARE
  _exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'public.exam_submissions'::regclass AND polname = 'exam_submissions teacher'
  ) INTO _exists;
  IF NOT _exists THEN
    EXECUTE 'CREATE POLICY "exam_submissions teacher" ON public.exam_submissions
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM exams e
        WHERE e.id = exam_submissions.exam_id
          AND (e.teacher_id = auth.uid()
               OR has_role(auth.uid(),''admin''::app_role)
               OR has_role(auth.uid(),''director''::app_role))
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM exams e
        WHERE e.id = exam_submissions.exam_id
          AND (e.teacher_id = auth.uid()
               OR has_role(auth.uid(),''admin''::app_role)
               OR has_role(auth.uid(),''director''::app_role))
      ))';
  END IF;
END
$guard$;