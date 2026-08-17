DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS indicator_code TEXT,
  ADD COLUMN IF NOT EXISTS indicator_description TEXT';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
