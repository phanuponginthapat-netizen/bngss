-- Restrict read access to plaintext IoT device API tokens.
-- The token must remain writable by admins via the form (INSERT/UPDATE on the column),
-- and readable by the iot-fetch Edge Function (which uses service_role).
-- Authenticated clients no longer need to read it back — the admin UI never displays
-- the existing token (password field with placeholder only).

REVOKE SELECT (api_token) ON public.iot_devices FROM authenticated, anon;
-- INSERT/UPDATE column privileges remain so admins can set/rotate the token.
GRANT INSERT (api_token), UPDATE (api_token) ON public.iot_devices TO authenticated;
-- service_role keeps full access for edge functions.
GRANT ALL ON public.iot_devices TO service_role;