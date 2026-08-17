DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.task_assignments
  ADD COLUMN IF NOT EXISTS submissions jsonb NOT NULL DEFAULT ''{}''::jsonb';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Allow students to update only the submissions column for class-wide homework in their classroom
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Students can submit class-wide homework" ON public.task_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Students can submit class-wide homework" ON public.task_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Students can submit class-wide homework"
ON public.task_assignments
FOR UPDATE
USING (
  task_type = ''homework''
  AND assigned_to_student_id IS NULL
  AND classroom_id IN (
    SELECT s.classroom_id FROM public.students s WHERE s.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  task_type = ''homework''
  AND assigned_to_student_id IS NULL
  AND classroom_id IN (
    SELECT s.classroom_id FROM public.students s WHERE s.auth_user_id = auth.uid()
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
