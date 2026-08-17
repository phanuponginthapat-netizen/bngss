DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.face_scan_logs ADD COLUMN IF NOT EXISTS captured_face_url TEXT';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
