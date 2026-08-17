-- Homework system: add submission fields to task_assignments
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.task_assignments
  ADD COLUMN IF NOT EXISTS submission_text text,
  ADD COLUMN IF NOT EXISTS submission_file_url text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS grade numeric,
  ADD COLUMN IF NOT EXISTS feedback text';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Allow students in the classroom to view homework rows assigned to them
-- (already covered by existing policy via assigned_to_user_id, but add a
-- fallback for cases where auth_user_id wasn't linked yet — match by student)
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Students can view own homework via student_id" ON public.task_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Students can view own homework via student_id" ON public.task_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Students can view own homework via student_id"
ON public.task_assignments
FOR SELECT
TO authenticated
USING (
  assigned_to_student_id IN (
    SELECT id FROM public.students WHERE auth_user_id = auth.uid()
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Allow the student (matched via students.auth_user_id) to update their own
-- submission/status even if assigned_to_user_id wasn't set at creation time
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Students can submit own homework" ON public.task_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Students can submit own homework" ON public.task_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Students can submit own homework"
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
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
