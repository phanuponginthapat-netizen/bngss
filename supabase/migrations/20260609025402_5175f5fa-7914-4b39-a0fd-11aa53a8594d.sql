DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.substitute_teaching
  ADD COLUMN IF NOT EXISTS proof_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_uploaded_by UUID';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
CREATE OR REPLACE FUNCTION public.finalize_past_substitute_teaching()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INT := 0;
BEGIN
  WITH u AS (
    UPDATE public.substitute_teaching
    SET status = 'no_substitute'
    WHERE status = 'pending'
      AND teaching_date < CURRENT_DATE
    RETURNING 1
  )
  SELECT COUNT(*) INTO updated_count FROM u;
  RETURN updated_count;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.finalize_past_substitute_teaching() TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
