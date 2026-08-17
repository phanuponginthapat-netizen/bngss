select cron.unschedule('line-vault-drive-cleanup') where exists (select 1 from cron.job where jobname='line-vault-drive-cleanup');
select cron.schedule('line-vault-drive-cleanup','*/5 * * * *', $job$
  SELECT net.http_post(
    url := 'https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1/line-vault-drive-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE((SELECT value FROM public.app_secrets WHERE key = 'CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  );
$job$);
