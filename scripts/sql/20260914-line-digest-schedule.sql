-- LINE digest: 1 ข้อความ/วัน + ผู้ดูแลตั้งเวลาและวันเองได้
-- cron ทำงานทุก 15 นาที แล้วให้ edge function ตัดสินใจว่าถึงเวลาส่งหรือยัง
-- ปฏิทินถูกรวมไว้ในข้อความรายงานการมาโรงเรียน (ยกเลิก cron ปฏิทินแยก)

INSERT INTO public.school_settings (setting_key, setting_value)
VALUES
  ('line_digest_enabled', 'true'),
  ('line_digest_time', '10:00'),
  ('line_digest_days', '1,2,3,4,5'),
  ('line_digest_include_calendar', 'true')
ON CONFLICT (setting_key) DO NOTHING;

DO $do$
BEGIN
  PERFORM cron.unschedule('line-vault-attendance-digest')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'line-vault-attendance-digest');
  PERFORM cron.unschedule('line-vault-calendar-digest')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'line-vault-calendar-digest');

  PERFORM cron.schedule('line-vault-attendance-digest', '*/15 * * * *',
    $cmd$SELECT public.cron_invoke('notify-attendance-digest', '{}'::jsonb, 120000);$cmd$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron reschedule skipped: %', SQLERRM;
END
$do$;
