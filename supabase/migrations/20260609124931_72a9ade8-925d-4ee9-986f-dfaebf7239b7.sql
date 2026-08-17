-- 1) Revoke column-level SELECT on ai_provider_keys.api_key from non-service roles
DO $guard$
BEGIN
  EXECUTE 'REVOKE SELECT (api_key) ON public.ai_provider_keys FROM anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) Drop overly-broad teacher SELECT policy on documents (recipients-scoped policy remains)
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Teachers view documents" ON public.documents';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
