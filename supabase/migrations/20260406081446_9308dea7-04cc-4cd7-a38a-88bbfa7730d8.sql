-- Add face_photos array column to personnel (keep face_photo_url for backward compat)
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS face_photos text[] DEFAULT ARRAY[]::text[]';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
