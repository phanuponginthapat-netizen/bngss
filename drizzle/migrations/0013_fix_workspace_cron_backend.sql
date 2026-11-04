-- lovable-cron-fallback-reviewed: Preserve the existing configurable attendance digest delivery window with one 15-minute check; no row event can trigger a clock-based daily delivery.
CREATE OR REPLACE FUNCTION public.cron_invoke(_function_name text, _body jsonb DEFAULT '{}'::jsonb, _timeout_ms integer DEFAULT 30000)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, net AS $fn$
DECLARE v_cron_secret text; v_service_key text; v_headers jsonb; v_request_id bigint;
BEGIN
  _function_name := NULLIF(btrim(_function_name), '');
  IF _function_name IS NULL OR _function_name !~ '^[a-z0-9][a-z0-9_-]*$' THEN
    RAISE LOG 'cron_invoke skipped: invalid function name'; RETURN NULL;
  END IF;
  SELECT NULLIF(btrim(value), '') INTO v_cron_secret FROM public.app_secrets WHERE key = 'CRON_SECRET' LIMIT 1;
  SELECT NULLIF(btrim(value), '') INTO v_service_key FROM public.app_secrets WHERE key = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  v_headers := jsonb_build_object('Content-Type', 'application/json');
  IF v_cron_secret IS NOT NULL THEN v_headers := v_headers || jsonb_build_object('x-cron-secret', v_cron_secret); END IF;
  IF v_service_key IS NOT NULL THEN v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_service_key); END IF;
  IF v_cron_secret IS NULL AND v_service_key IS NULL THEN
    RAISE LOG 'cron_invoke skipped: credentials unavailable'; RETURN NULL;
  END IF;
  SELECT net.http_post(url := 'https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1/' || _function_name,
    headers := v_headers, body := COALESCE(_body, '{}'::jsonb),
    timeout_milliseconds := LEAST(GREATEST(COALESCE(_timeout_ms, 30000), 1000), 120000)) INTO v_request_id;
  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'cron_invoke failed safely for %: %', _function_name, SQLSTATE; RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION public.cron_invoke(text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_invoke(text, jsonb, integer) TO service_role;
CREATE OR REPLACE FUNCTION public.ensure_attendance_digest_cron()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron, extensions, net AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF to_regclass('cron.job') IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'pg_cron not installed'); END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'line-vault-attendance-digest';
  PERFORM cron.schedule('line-vault-attendance-digest', '*/15 * * * *',
    $cmd$SELECT public.cron_invoke('notify-attendance-digest', '{}'::jsonb, 120000);$cmd$);
  RETURN jsonb_build_object('ok', true, 'schedule', '*/15 * * * *');
END;
$fn$;
REVOKE ALL ON FUNCTION public.ensure_attendance_digest_cron() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_attendance_digest_cron() TO authenticated, service_role;