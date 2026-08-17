DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.id_plan_records
  ADD COLUMN IF NOT EXISTS order_doc_path text,
  ADD COLUMN IF NOT EXISTS image_paths text[] NOT NULL DEFAULT ''{}''::text[]';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
