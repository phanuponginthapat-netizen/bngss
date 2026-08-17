DROP FUNCTION IF EXISTS public.mig_dump_auth(text) CASCADE;
CREATE OR REPLACE FUNCTION public.mig_dump_auth(_table text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE result jsonb;
BEGIN
  IF _table NOT IN ('users','identities') THEN
    RAISE EXCEPTION 'unsupported table %', _table;
  END IF;
  IF _table = 'users' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) INTO result FROM auth.users u;
  ELSE
    SELECT coalesce(jsonb_agg(i), '[]'::jsonb) INTO result FROM auth.identities i;
  END IF;
  RETURN result;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.mig_dump_auth(text) FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.mig_dump_auth(text) TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
