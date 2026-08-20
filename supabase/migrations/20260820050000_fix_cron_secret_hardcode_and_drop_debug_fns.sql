-- แก้ cron job ที่ฝัง CRON_SECRET hardcode ใน SQL → อ่านจาก app_secrets เหมือน job อื่น
SELECT cron.unschedule('line-vault-calendar-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='line-vault-calendar-digest');
SELECT cron.schedule('line-vault-calendar-digest','0 0 * * *', $job$
  SELECT net.http_post(
    url := 'https://gwmszzoqqxmejefhayqf.supabase.co/functions/v1/notify-calendar-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE((SELECT value FROM public.app_secrets WHERE key = 'CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb
  );
$job$);

SELECT cron.unschedule('line-vault-attendance-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='line-vault-attendance-digest');
SELECT cron.schedule('line-vault-attendance-digest','0 3 * * 1-5', $job$
  SELECT net.http_post(
    url := 'https://gwmszzoqqxmejefhayqf.supabase.co/functions/v1/notify-attendance-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE((SELECT value FROM public.app_secrets WHERE key = 'CRON_SECRET' LIMIT 1), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$job$);

-- ลบฟังก์ชัน debug ที่หลงเหลือ (authenticated เรียกได้ ไม่ควรมีใน production)
DROP FUNCTION IF EXISTS public.__stats();
DROP FUNCTION IF EXISTS public.__stats2();
DROP FUNCTION IF EXISTS public.__tmp_src();