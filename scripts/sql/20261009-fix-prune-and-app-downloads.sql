-- 20261009 — แก้ error 42703 "column created_at does not exist" ของงาน prune-operational-data (02:30)
-- และแก้อัปโหลด APK ลง app-downloads ล้มเหลว
-- รันใน SQL editor ของเซิร์ฟเวอร์ข้อมูลโรงเรียน

-- 1) ลบเฉพาะตารางที่มีอยู่จริง และเลือกคอลัมน์เวลาที่ตารางนั้นมีจริง
CREATE OR REPLACE FUNCTION public.prune_operational_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb := '{}'::jsonb;
  n bigint;
  r record;
  col text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('notifications', 120), ('inbox_items', 180), ('error_logs', 90),
    ('kiosk_health_samples', 30), ('rate_limit_logs', 7)
  ) AS t(tbl, days)
  LOOP
    SELECT c.column_name INTO col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = r.tbl
      AND c.column_name IN ('created_at', 'recorded_at', 'sampled_at', 'logged_at', 'timestamp', 'inserted_at', 'window_start')
    ORDER BY array_position(ARRAY['created_at','recorded_at','sampled_at','logged_at','timestamp','inserted_at','window_start'], c.column_name::text)
    LIMIT 1;

    IF col IS NULL THEN
      v := v || jsonb_build_object(r.tbl, 'skipped');
      CONTINUE;
    END IF;

    EXECUTE format('DELETE FROM public.%I WHERE %I < now() - make_interval(days => %s)', r.tbl, col, r.days);
    GET DIAGNOSTICS n = ROW_COUNT;
    v := v || jsonb_build_object(r.tbl, n);
  END LOOP;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_operational_data() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_operational_data() TO service_role;

-- 2) app-downloads: เพิ่มเพดานไฟล์ (APK/IPA/FaceGate ZIP ใหญ่เกินโควต้าเดิม 20 MB)
UPDATE storage.buckets SET file_size_limit = 209715200, allowed_mime_types = NULL WHERE id = 'app-downloads';
UPDATE public.storage_tier_policies SET quota_mb = 400, keep_recent = 2 WHERE bucket = 'app-downloads';

-- 3) ทดสอบ
SELECT public.prune_operational_data();
