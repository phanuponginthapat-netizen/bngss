-- ซ่อมการส่งสรุปการมาโรงเรียนเข้า LINE หลังย้าย workspace
-- รันใน SQL Editor ของ Supabase โรงเรียน (gwmszzoqqxmejefhayqf)
INSERT INTO public.app_secrets (key, value)
VALUES ('SUPABASE_URL', 'https://gwmszzoqqxmejefhayqf.supabase.co')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

DO $do$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('line-vault-attendance-digest','daily-line-digest-morning');
  -- ทุก 15 นาที แล้วฟังก์ชันจะเช็ควัน/เวลาที่ตั้งไว้เอง และส่งได้วันละครั้ง
  PERFORM cron.schedule('line-vault-attendance-digest', '*/15 * * * *',
    $cmd$SELECT public.cron_invoke('notify-attendance-digest', '{}'::jsonb, 120000);$cmd$);
END $do$;

-- ตรวจผล: SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%digest%';
--         SELECT id, status_code, left(content::text,200) FROM net._http_response ORDER BY id DESC LIMIT 5;
