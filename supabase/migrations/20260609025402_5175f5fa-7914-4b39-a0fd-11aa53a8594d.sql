
ALTER TABLE public.substitute_teaching
  ADD COLUMN IF NOT EXISTS proof_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_uploaded_by UUID;

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

GRANT EXECUTE ON FUNCTION public.finalize_past_substitute_teaching() TO authenticated;
