DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.print_templates
  ADD COLUMN IF NOT EXISTS background_url TEXT,
  ADD COLUMN IF NOT EXISTS overlay_mode BOOLEAN NOT NULL DEFAULT false';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
