ALTER TABLE public.task_assignments
  ADD COLUMN IF NOT EXISTS submissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Allow students to update only the submissions column for class-wide homework in their classroom
DROP POLICY IF EXISTS "Students can submit class-wide homework" ON public.task_assignments;
CREATE POLICY "Students can submit class-wide homework"
ON public.task_assignments
FOR UPDATE
USING (
  task_type = 'homework'
  AND assigned_to_student_id IS NULL
  AND classroom_id IN (
    SELECT s.classroom_id FROM public.students s WHERE s.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  task_type = 'homework'
  AND assigned_to_student_id IS NULL
  AND classroom_id IN (
    SELECT s.classroom_id FROM public.students s WHERE s.auth_user_id = auth.uid()
  )
);
