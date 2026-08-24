CREATE OR REPLACE FUNCTION public.cron_invoke(
  _function_name text,
  _body jsonb DEFAULT '{}'::jsonb,
  _timeout_ms integer DEFAULT 30000
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $fn$
DECLARE
  v_base_url text;
  v_cron_secret text;
  v_service_key text;
  v_url text;
  v_headers jsonb;
  v_request_id bigint;
BEGIN
  _function_name := NULLIF(btrim(_function_name), '');
  IF _function_name IS NULL OR _function_name !~ '^[a-z0-9][a-z0-9_-]*$' THEN
    RAISE LOG 'cron_invoke skipped: invalid function name';
    RETURN NULL;
  END IF;

  BEGIN
    SELECT NULLIF(btrim(value), '') INTO v_base_url
    FROM public.app_secrets WHERE key = 'SUPABASE_URL' LIMIT 1;
    SELECT NULLIF(btrim(value), '') INTO v_cron_secret
    FROM public.app_secrets WHERE key = 'CRON_SECRET' LIMIT 1;
    SELECT NULLIF(btrim(value), '') INTO v_service_key
    FROM public.app_secrets WHERE key = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'cron_invoke credential lookup warning: %', SQLERRM;
  END;

  v_base_url := COALESCE(
    v_base_url,
    NULLIF(current_setting('app.settings.supabase_url', true), ''),
    'https://gwmszzoqqxmejefhayqf.supabase.co'
  );
  v_base_url := rtrim(btrim(v_base_url), '/');

  IF v_base_url = '' OR v_base_url !~ '^https://[A-Za-z0-9.-]+(?::[0-9]+)?$' THEN
    RAISE LOG 'cron_invoke skipped: backend URL is missing or invalid';
    RETURN NULL;
  END IF;

  v_url := v_base_url || '/functions/v1/' || _function_name;
  v_headers := jsonb_build_object('Content-Type', 'application/json');
  IF v_cron_secret IS NOT NULL THEN
    v_headers := v_headers || jsonb_build_object('x-cron-secret', v_cron_secret);
  END IF;
  IF v_service_key IS NOT NULL THEN
    v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_service_key);
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := v_headers,
    body := COALESCE(_body, '{}'::jsonb),
    timeout_milliseconds := LEAST(GREATEST(COALESCE(_timeout_ms, 30000), 1000), 120000)
  ) INTO v_request_id;

  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'cron_invoke(%s) failed safely: %', _function_name, SQLERRM;
  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.cron_invoke(text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_invoke(text, jsonb, integer) TO service_role;

DO $jobs$
DECLARE
  j record;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RETURN;
  END IF;

  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'kiosk-offline-alert',
      'obec-calendar-sync',
      'cleanup-orphan-storage-weekly',
      'line-vault-drive-cleanup',
      'line-vault-calendar-digest',
      'line-vault-attendance-digest'
    )
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;

  PERFORM cron.schedule('kiosk-offline-alert', '*/5 * * * *',
    $cmd$SELECT public.cron_invoke('kiosk-offline-alert', '{}'::jsonb, 30000);$cmd$);
  PERFORM cron.schedule('obec-calendar-sync', '0 3 * * *',
    $cmd$SELECT public.cron_invoke('obec-calendar-sync', '{}'::jsonb, 120000);$cmd$);
  PERFORM cron.schedule('cleanup-orphan-storage-weekly', '0 4 * * 0',
    $cmd$SELECT public.cron_invoke('cleanup-orphan-storage', '{"minAgeDays":7}'::jsonb, 120000);$cmd$);
  PERFORM cron.schedule('line-vault-drive-cleanup', '*/5 * * * *',
    $cmd$SELECT public.cron_invoke('line-vault-drive-cleanup', '{}'::jsonb, 30000);$cmd$);
  PERFORM cron.schedule('line-vault-calendar-digest', '0 0 * * *',
    $cmd$SELECT public.cron_invoke('notify-calendar-digest', '{}'::jsonb, 120000);$cmd$);
  PERFORM cron.schedule('line-vault-attendance-digest', '0 3 * * 1-5',
    $cmd$SELECT public.cron_invoke('notify-attendance-digest', '{}'::jsonb, 120000);$cmd$);
END;
$jobs$;