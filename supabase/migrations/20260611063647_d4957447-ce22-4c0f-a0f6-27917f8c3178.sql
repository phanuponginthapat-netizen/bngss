DROP POLICY IF EXISTS "Students can view class-wide homework" ON public.task_assignments;
DROP POLICY IF EXISTS "Students can view class-wide homework" ON public.task_assignments;
CREATE POLICY "Students can view class-wide homework"
ON public.task_assignments
FOR SELECT
USING (
  task_type = 'homework'
  AND assigned_to_student_id IS NULL
  AND classroom_id IN (
    SELECT s.classroom_id FROM public.students s WHERE s.auth_user_id = auth.uid()
  )
);
