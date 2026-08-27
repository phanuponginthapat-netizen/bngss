-- ลดการใช้ RAM/แคชของฐานข้อมูล และเพิ่มประสิทธิภาพ
-- 1) ลบดัชนีซ้ำซ้อน (ซ้ำคอลัมน์เดียวกัน) เพื่อลด buffer cache และเร่ง INSERT/UPDATE
DROP INDEX IF EXISTS public.idx_face_scan_logs_scan_date;
DROP INDEX IF EXISTS public.idx_face_scan_logs_school_date_brin;
DROP INDEX IF EXISTS public.idx_face_scan_date_student;
DROP INDEX IF EXISTS public.idx_activities_start_at;
DROP INDEX IF EXISTS public.idx_activity_matches_activity;
DROP INDEX IF EXISTS public.idx_activity_participants_activity;
DROP INDEX IF EXISTS public.idx_activity_participants_student;
DROP INDEX IF EXISTS public.idx_activity_scores_participant;
DROP INDEX IF EXISTS public.idx_activity_scores_activity;
DROP INDEX IF EXISTS public.ar_experiences_code_idx;
DROP INDEX IF EXISTS public.idx_attendance_student_date_desc;
DROP INDEX IF EXISTS public.idx_backup_snapshots_table_date;
DROP INDEX IF EXISTS public.idx_behavior_records_student;
DROP INDEX IF EXISTS public.idx_fk_certificate_issues_template_id;
DROP INDEX IF EXISTS public.idx_certificate_issues_student;
DROP INDEX IF EXISTS public.idx_cms_settings_key;
DROP INDEX IF EXISTS public.idx_finance_month_close_month;
DROP INDEX IF EXISTS public.idx_game_hub_scores_auto1;
DROP INDEX IF EXISTS public.idx_game_hub_scores_auto2;
DROP INDEX IF EXISTS public.idx_fk_kiosk_devices_user_id;
DROP INDEX IF EXISTS public.idx_kiosk_health_samples_dev_time;
DROP INDEX IF EXISTS public.idx_personnel_school;
DROP INDEX IF EXISTS public.idx_profiles_line_user_id;
DROP INDEX IF EXISTS public.idx_sop_trip;
DROP INDEX IF EXISTS public.idx_students_line_user_id;
DROP INDEX IF EXISTS public.idx_students_line_user_id_2;
DROP INDEX IF EXISTS public.idx_students_line_user_id_3;
DROP INDEX IF EXISTS public.idx_students_school;
DROP INDEX IF EXISTS public.worksheets_share_code_idx;

-- 2) autovacuum เชิงรุกสำหรับตาราง log ที่เขียนบ่อย (ลด bloat = ลด RAM)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'face_scan_logs','kiosk_health_samples','notifications','inbox_items',
    'error_logs','ai_usage_logs','audit_logs','rate_limit_logs',
    'notification_delivery_log','browser_logs','google_chat_logs','district_feed_logs'
  ] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I SET (autovacuum_vacuum_scale_factor=0.02, autovacuum_analyze_scale_factor=0.02, autovacuum_vacuum_cost_delay=2)', t);
    END IF;
  END LOOP;
END $$;

-- 3) ฟังก์ชันล้าง log เก่าอัตโนมัติ (เก็บเฉพาะช่วงที่ยังใช้งานจริง)
CREATE OR REPLACE FUNCTION public.cleanup_runtime_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  spec  jsonb := '[
    {"t":"face_scan_logs","c":"created_at","d":365},
    {"t":"kiosk_health_samples","c":"sampled_at","d":30},
    {"t":"error_logs","c":"created_at","d":90},
    {"t":"browser_logs","c":"created_at","d":30},
    {"t":"ai_usage_logs","c":"created_at","d":180},
    {"t":"ai_chat_logs","c":"created_at","d":180},
    {"t":"rate_limit_logs","c":"created_at","d":7},
    {"t":"notification_delivery_log","c":"created_at","d":90},
    {"t":"google_chat_logs","c":"created_at","d":90},
    {"t":"district_feed_logs","c":"created_at","d":90},
    {"t":"audit_logs","c":"created_at","d":365},
    {"t":"notifications","c":"created_at","d":180},
    {"t":"inbox_items","c":"created_at","d":180}
  ]'::jsonb;
  item  jsonb;
  n     bigint;
  out_j jsonb := '{}'::jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(spec) LOOP
    IF to_regclass('public.'||(item->>'t')) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=item->>'t' AND column_name=item->>'c'
    ) THEN CONTINUE; END IF;

    EXECUTE format(
      'WITH d AS (DELETE FROM public.%I WHERE %I < now() - ($1||'' days'')::interval RETURNING 1) SELECT count(*) FROM d',
      item->>'t', item->>'c')
    INTO n USING (item->>'d')::int;

    out_j := out_j || jsonb_build_object(item->>'t', n);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'deleted', out_j, 'at', now());
END $$;

REVOKE ALL ON FUNCTION public.cleanup_runtime_logs() FROM PUBLIC, anon, authenticated;

-- 4) ตั้ง cron รายวัน (ตี 2 UTC = 09:00 น. ไทย ยังไม่ชนช่วงใช้งานหนัก)
SELECT cron.unschedule('cleanup-runtime-logs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cleanup-runtime-logs');
SELECT cron.schedule('cleanup-runtime-logs', '20 19 * * *', 'SELECT public.cleanup_runtime_logs();');
