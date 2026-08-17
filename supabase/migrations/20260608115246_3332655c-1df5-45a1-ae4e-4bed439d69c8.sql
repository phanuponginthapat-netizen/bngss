-- Restrict read access to plaintext IoT device API tokens.
-- The token must remain writable by admins via the form (INSERT/UPDATE on the column),
-- and readable by the iot-fetch Edge Function (which uses service_role).
-- Authenticated clients no longer need to read it back — the admin UI never displays
-- the existing token (password field with placeholder only).

DO $guard$
BEGIN
  EXECUTE 'REVOKE SELECT (api_token) ON public.iot_devices FROM authenticated, anon';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- INSERT/UPDATE column privileges remain so admins can set/rotate the token.
DO $guard$
BEGIN
  EXECUTE 'GRANT INSERT (api_token), UPDATE (api_token) ON public.iot_devices TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- service_role keeps full access for edge functions.
DO $guard$
BEGIN
  EXECUTE 'GRANT ALL ON public.iot_devices TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
