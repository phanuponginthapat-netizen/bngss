DO $job$
DECLARE
  j record;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RETURN;
  END IF;

  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'early-warning-cron-daily'
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'early-warning-cron-daily',
    '0 0 * * *',
    $cmd$SELECT public.cron_invoke('early-warning-cron', '{"trigger":"cron"}'::jsonb, 120000);$cmd$
  );
END;
$job$;