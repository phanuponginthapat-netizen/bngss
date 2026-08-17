DO $$
DECLARE
  v_job_id int;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'line-vault-drive-cleanup';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END$$;
SELECT cron.schedule(
  'line-vault-drive-cleanup',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1/line-vault-drive-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.app_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
