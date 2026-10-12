-- ชุดรวมแก้ backend 4 ข้อ (แจ้งเตือน, ล้างข้อมูล, ย้ายไฟล์ไป Drive) — ไม่ลบข้อมูลที่ใช้งาน
-- แจ้งเตือนหยุดส่งถึงเครื่องตั้งแต่ 7 ส.ค. 2026: trigger เรียก extensions.http_post ซึ่งไม่ได้ติดตั้ง
-- (error ถูกกลืนเงียบ) — เปลี่ยนมาใช้ pg_net ที่มีอยู่แล้ว
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url TEXT; service_key TEXT; target_url TEXT;
BEGIN
  IF NEW.push_sent THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  SELECT value INTO supabase_url FROM public.system_credentials WHERE key = 'supabase_url';
  SELECT value INTO service_key  FROM public.system_credentials WHERE key = 'service_role_key';
  IF coalesce(supabase_url,'') = '' OR coalesce(service_key,'') = '' THEN RETURN NEW; END IF;
  target_url := CASE
    WHEN NEW.reference_type = 'homework' THEN '/dashboard/homework'
    WHEN NEW.reference_type = 'eform'    THEN '/dashboard/eform/inbox'
    WHEN NEW.reference_type = 'leave'    THEN '/dashboard/leave'
    WHEN NEW.reference_type = 'news'     THEN '/dashboard/feed'
    WHEN NEW.reference_type = 'behavior' THEN '/dashboard/behavior'
    WHEN NEW.reference_type = 'attendance' THEN '/dashboard/attendance'
    ELSE '/dashboard' END;
  BEGIN
    PERFORM net.http_post(
      url := rtrim(supabase_url,'/') || '/functions/v1/send-push',
      body := jsonb_build_object('user_id', NEW.user_id, 'title', NEW.title,
        'body', COALESCE(NEW.message,''), 'url', target_url, 'tag', COALESCE(NEW.type,'notification')),
      headers := jsonb_build_object('Content-Type','application/json',
        'Authorization','Bearer ' || service_key, 'apikey', service_key),
      timeout_milliseconds := 10000);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push enqueue failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- svc_url()/svc_key() เดิมเรียกตัวเองซ้ำไม่รู้จบเมื่อไม่มีค่า — แก้ให้คืน NULL แทน
CREATE OR REPLACE FUNCTION public.svc_url() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT value FROM public.system_credentials WHERE key='supabase_url' $$;
CREATE OR REPLACE FUNCTION public.svc_key() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT value FROM public.system_credentials WHERE key='service_role_key' $$;

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

-- 3) งานย้ายไฟล์ประจำสัปดาห์: ใช้ที่อยู่/รหัสจาก system_credentials เหมือนระบบแจ้งเตือน
SELECT cron.schedule('weekly-storage-offload', '0 19 * * 6', $cron$
  SELECT net.http_post(
    url := rtrim(public.svc_url(),'/') || '/functions/v1/storage-tier',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || public.svc_key(), 'apikey', public.svc_key()),
    body := '{"action":"offload"}'::jsonb)
  WHERE public.svc_url() IS NOT NULL AND public.svc_key() IS NOT NULL;
$cron$);

-- 4) ตรวจผล (ทุกช่องควรเป็น true)
SELECT
  pg_get_functiondef('public.trigger_push_notification'::regproc) LIKE '%net.http_post%' AS push_fixed,
  (SELECT count(*) FROM public.system_credentials WHERE key IN ('supabase_url','service_role_key') AND coalesce(value,'')<>'') = 2 AS credentials_present,
  (SELECT command LIKE '%svc_url%' FROM cron.job WHERE jobname='weekly-storage-offload') AS offload_fixed;
SELECT public.prune_operational_data() AS prune_result;
