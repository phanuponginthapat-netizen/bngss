-- Allow backend service role to read/write app_secrets so edge functions can auto-provision
DO $guard$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.app_secrets TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Upsert helper callable by service_role (SECURITY DEFINER so it bypasses RLS cleanly)
DROP FUNCTION IF EXISTS public.set_app_secret(text, text, text, text) CASCADE;
CREATE OR REPLACE FUNCTION public.set_app_secret(_key text, _value text, _category text DEFAULT 'auto', _description text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_secrets(key, value, category, description, updated_at)
  VALUES (_key, _value, _category, _description, now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        category = COALESCE(EXCLUDED.category, public.app_secrets.category),
        description = COALESCE(EXCLUDED.description, public.app_secrets.description),
        updated_at = now();
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.set_app_secret(text, text, text, text) FROM PUBLIC';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.set_app_secret(text, text, text, text) TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
