DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.task_assignments
  ADD COLUMN IF NOT EXISTS annotated_file_url text,
  ADD COLUMN IF NOT EXISTS replies jsonb NOT NULL DEFAULT ''[]''::jsonb';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
