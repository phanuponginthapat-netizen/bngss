-- Homework system: add submission fields to task_assignments
ALTER TABLE public.task_assignments
  ADD COLUMN IF NOT EXISTS submission_text text,
  ADD COLUMN IF NOT EXISTS submission_file_url text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS grade numeric,
  ADD COLUMN IF NOT EXISTS feedback text;

-- Allow students in the classroom to view homework rows assigned to them
-- (already covered by existing policy via assigned_to_user_id, but add a
-- fallback for cases where auth_user_id wasn't linked yet — match by student)
DROP POLICY IF EXISTS "Students can view own homework via student_id" ON public.task_assignments;
DROP POLICY IF EXISTS "Students can view own homework via student_id" ON public.task_assignments;
CREATE POLICY "Students can view own homework via student_id"
ON public.task_assignments
FOR SELECT
TO authenticated
USING (
  assigned_to_student_id IN (
    SELECT id FROM public.students WHERE auth_user_id = auth.uid()
  )
);

-- Allow the student (matched via students.auth_user_id) to update their own
-- submission/status even if assigned_to_user_id wasn't set at creation time
DROP POLICY IF EXISTS "Students can submit own homework" ON public.task_assignments;
DROP POLICY IF EXISTS "Students can submit own homework" ON public.task_assignments;
CREATE POLICY "Students can submit own homework"
ON public.task_assignments
FOR UPDATE
TO authenticated
USING (
  assigned_to_student_id IN (
    SELECT id FROM public.students WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  assigned_to_student_id IN (
    SELECT id FROM public.students WHERE auth_user_id = auth.uid()
  )
);