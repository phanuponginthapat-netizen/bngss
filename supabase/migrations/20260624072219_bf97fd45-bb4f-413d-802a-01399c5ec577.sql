DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "ict_loans_block_students_from_personnel_loans_select" ON public.ict_loans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "ict_loans_block_students_from_personnel_loans_select" ON public.ict_loans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "ict_loans_block_students_from_personnel_loans_select"
  ON public.ict_loans AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    personnel_id IS NULL
    OR public.has_role(auth.uid(), ''admin'')
    OR public.has_role(auth.uid(), ''director'')
    OR public.has_role(auth.uid(), ''teacher'')
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "ict_loans_block_students_from_personnel_loans_update" ON public.ict_loans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "ict_loans_block_students_from_personnel_loans_update" ON public.ict_loans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "ict_loans_block_students_from_personnel_loans_update"
  ON public.ict_loans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    personnel_id IS NULL
    OR public.has_role(auth.uid(), ''admin'')
    OR public.has_role(auth.uid(), ''director'')
    OR public.has_role(auth.uid(), ''teacher'')
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
