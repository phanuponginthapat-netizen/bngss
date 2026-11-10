CREATE OR REPLACE FUNCTION public.cron_invoke(_function_name text, _body jsonb DEFAULT '{}'::jsonb, _timeout_ms integer DEFAULT 30000)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_cron_secret text; v_headers jsonb; v_request_id bigint;
  v_anon constant text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsa3l4dmhubmZmYmxlcndlZGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjY5MTIsImV4cCI6MjA5OTk0MjkxMn0.bQqqX3veJ_pGr9fSa0a-bKIS-w7UmR569a2xDZQ6Cx4';
BEGIN
  _function_name := NULLIF(btrim(_function_name), '');
  IF _function_name IS NULL OR _function_name !~ '^[a-z0-9][a-z0-9_-]*$' THEN
    RAISE LOG 'cron_invoke skipped: invalid function name'; RETURN NULL;
  END IF;
  SELECT NULLIF(btrim(value), '') INTO v_cron_secret FROM public.app_secrets WHERE key = 'CRON_SECRET' LIMIT 1;
  IF v_cron_secret IS NULL THEN RAISE LOG 'cron_invoke skipped: CRON_SECRET missing'; RETURN NULL; END IF;
  v_headers := jsonb_build_object('Content-Type','application/json','apikey',v_anon,'Authorization','Bearer '||v_anon,'x-cron-secret',v_cron_secret);
  SELECT net.http_post(url := 'https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1/' || _function_name,
    headers := v_headers, body := COALESCE(_body, '{}'::jsonb),
    timeout_milliseconds := LEAST(GREATEST(COALESCE(_timeout_ms, 30000), 1000), 120000)) INTO v_request_id;
  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'cron_invoke failed safely for %: %', _function_name, SQLSTATE; RETURN NULL;
END;
$fn$;