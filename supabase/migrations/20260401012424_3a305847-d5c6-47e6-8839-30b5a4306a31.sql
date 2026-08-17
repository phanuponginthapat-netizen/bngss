DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.homeroom_records
  ADD COLUMN IF NOT EXISTS homeroom_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS topic text DEFAULT ''general'',
  ADD COLUMN IF NOT EXISTS activity_details text,
  ADD COLUMN IF NOT EXISTS student_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_students text';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
