DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.subjects 
  ADD COLUMN IF NOT EXISTS weeks_per_semester integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS pp5_period_dates date[] NOT NULL DEFAULT ''{}''::date[]';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
