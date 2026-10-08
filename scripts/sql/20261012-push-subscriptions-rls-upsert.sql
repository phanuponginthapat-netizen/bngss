-- Fix 42501 "new row violates row-level security policy (USING expression)" on push_subscriptions.
-- Cause: devices re-register with upsert (ON CONFLICT DO UPDATE) but the table had no UPDATE policy,
-- so every re-registration of an existing device was rejected and the app retried forever.

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- One call registers the current device for the signed-in user. A shared device (another account
-- signed in earlier) is moved to the current user so the previous account stops receiving its pushes.
CREATE OR REPLACE FUNCTION public.register_push_subscription(
  _endpoint text,
  _p256dh text DEFAULT '',
  _auth text DEFAULT '',
  _device_token text DEFAULT NULL,
  _provider text DEFAULT 'webpush',
  _platform text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF coalesce(_endpoint, '') = '' THEN
    RAISE EXCEPTION 'endpoint required' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.push_subscriptions
   WHERE user_id <> _uid
     AND (endpoint = _endpoint OR (_device_token IS NOT NULL AND device_token = _device_token));

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, device_token, provider, platform)
  VALUES (_uid, _endpoint, coalesce(_p256dh, ''), coalesce(_auth, ''), _device_token,
          coalesce(_provider, 'webpush'), _platform)
  ON CONFLICT (user_id, endpoint) DO UPDATE
    SET p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        device_token = EXCLUDED.device_token,
        provider = EXCLUDED.provider,
        platform = EXCLUDED.platform;

  BEGIN
    EXECUTE 'UPDATE public.push_subscriptions SET updated_at = now() WHERE user_id = $1 AND endpoint = $2'
      USING _uid, _endpoint;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
