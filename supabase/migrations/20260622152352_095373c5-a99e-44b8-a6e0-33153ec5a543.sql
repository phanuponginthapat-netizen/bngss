DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS weight_assignment numeric NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS weight_midterm    numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS weight_final      numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS weight_attendance numeric NOT NULL DEFAULT 0';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
