DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS reference_grade_level text';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'COMMENT ON COLUMN public.classrooms.reference_grade_level IS ''For special-needs classrooms: the actual grade level (ป.1-ม.6) the students belong to for reporting/aggregation. NULL means use grade_level directly.''';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
