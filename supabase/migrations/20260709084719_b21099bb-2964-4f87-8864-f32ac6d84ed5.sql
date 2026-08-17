-- 90-day retention for browser_logs (พรบ.คอมฯ ม.26)
CREATE OR REPLACE FUNCTION public.cleanup_browser_logs_90d()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.browser_logs WHERE created_at < now() - interval '90 days';
$$;
-- unschedule old job if exists then schedule daily at 03:15
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'cleanup-browser-logs-90d';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
  PERFORM cron.schedule(
    'cleanup-browser-logs-90d',
    '15 3 * * *',
    $c$SELECT public.cleanup_browser_logs_90d();$c$
  );
END $$;
