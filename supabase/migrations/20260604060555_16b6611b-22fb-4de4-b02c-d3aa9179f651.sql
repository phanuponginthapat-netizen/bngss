-- Drop the overly-permissive WITH CHECK (true) insert policy.
-- Edge functions log via service_role which bypasses RLS, so no policy is needed for inserts.
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Service role inserts logs" ON public.ai_usage_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE INSERT ON public.ai_usage_logs FROM authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
