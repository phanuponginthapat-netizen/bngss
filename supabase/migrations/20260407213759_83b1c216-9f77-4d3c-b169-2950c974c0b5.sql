DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS homeroom_teacher_2 text DEFAULT NULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
