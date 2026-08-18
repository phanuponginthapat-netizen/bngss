-- แก้ cron job line-vault-drive-cleanup ให้ชี้ไปโปรเจกต์ใหม่แทนโปรเจกต์เก่าที่ block ไปแล้ว
SELECT cron.unschedule('line-vault-drive-cleanup') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='line-vault-drive-cleanup');
SELECT cron.schedule('line-vault-drive-cleanup','*/5 * * * *', $job$
  SELECT net.http_post(
    url := 'https://gwmszzoqqxmejefhayqf.supabase.co/functions/v1/line-vault-drive-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE((SELECT value FROM public.app_secrets WHERE key = 'CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  );
$job$);