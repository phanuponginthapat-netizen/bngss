DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS is_special_needs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_needs_type text';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS students_is_special_needs_idx
  ON public.students (is_special_needs) WHERE is_special_needs = true';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
