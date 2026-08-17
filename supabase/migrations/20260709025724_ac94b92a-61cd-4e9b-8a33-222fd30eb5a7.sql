DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Teachers can manage assessment_criteria" ON public.assessment_criteria';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
