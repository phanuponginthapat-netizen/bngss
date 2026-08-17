DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.line_vault_groups ADD COLUMN IF NOT EXISTS notify_on_capture BOOLEAN NOT NULL DEFAULT true';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
