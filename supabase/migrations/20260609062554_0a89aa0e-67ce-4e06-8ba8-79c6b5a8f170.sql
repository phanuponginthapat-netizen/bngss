DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can view students in their school" ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can view students in their school" ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Staff can view students in their school"
ON public.students FOR SELECT
USING (
  has_role(auth.uid(), ''admin''::app_role)
  OR has_role(auth.uid(), ''director''::app_role)
  OR (
    has_role(auth.uid(), ''teacher''::app_role)
    AND (
      school_id IS NULL
      OR get_user_school_id(auth.uid()) IS NULL
      OR school_id = get_user_school_id(auth.uid())
    )
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
