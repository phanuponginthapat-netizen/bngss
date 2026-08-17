DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.homework_assignments
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_pages int,
  ADD COLUMN IF NOT EXISTS worksheet_fields jsonb NOT NULL DEFAULT ''[]''::jsonb,
  ADD COLUMN IF NOT EXISTS total_score numeric';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS auto_score numeric,
  ADD COLUMN IF NOT EXISTS final_score numeric,
  ADD COLUMN IF NOT EXISTS field_results jsonb NOT NULL DEFAULT ''{}''::jsonb';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
