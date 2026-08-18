DROP FUNCTION IF EXISTS public.ensure_attendance_digest_cron();

CREATE FUNCTION public.ensure_attendance_digest_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions, net
AS $fn$
DECLARE
  base_url text;
  cron_secret text;
  cmd text;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pg_cron not installed');
  END IF;

  SELECT value INTO base_url FROM public.app_secrets WHERE key = 'SUPABASE_URL' LIMIT 1;
  IF base_url IS NULL OR base_url = '' OR base_url LIKE '%dlkyxvhnnffblerwedjz%' THEN
    base_url := 'https://gwmszzoqqxmejefhayqf.supabase.co';
  END IF;
  base_url := rtrim(base_url, '/');

  SELECT value INTO cron_secret FROM public.app_secrets WHERE key = 'CRON_SECRET' LIMIT 1;
  cron_secret := COALESCE(cron_secret, '');

  cmd := format($cmd$
    SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $cmd$,
    base_url || '/functions/v1/notify-attendance-digest',
    jsonb_build_object('Content-Type','application/json','x-cron-secret', cron_secret)::text
  );

  BEGIN
    PERFORM cron.unschedule('line-vault-attendance-digest')
    FROM cron.job WHERE jobname = 'line-vault-attendance-digest';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule('line-vault-attendance-digest', '0 3 * * 1-5', cmd);

  RETURN jsonb_build_object(
    'ok', true,
    'url', base_url || '/functions/v1/notify-attendance-digest',
    'has_secret', cron_secret <> '',
    'schedule', '0 3 * * 1-5'
  );
END;
$fn$;

DO $g$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.ensure_attendance_digest_cron() TO authenticated, service_role';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'grant skipped: %', SQLERRM;
END
$g$;

DO $run$
BEGIN
  PERFORM public.ensure_attendance_digest_cron();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ensure_attendance_digest_cron failed: %', SQLERRM;
END
$run$;