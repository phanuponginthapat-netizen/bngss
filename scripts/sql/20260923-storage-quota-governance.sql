-- ============================================================================
-- 20260923 — Storage quota governance (free-tier friendly)
-- เป้าหมาย: คุมพื้นที่ Supabase Storage ให้อยู่ต่ำกว่า 1 GB (free tier)
-- โดยแบ่งโควต้าตามความสำคัญของงานโรงเรียน และลดไฟล์ซ้ำซ้อนกับ Google Drive
-- ============================================================================

ALTER TABLE public.storage_tier_policies
  ADD COLUMN IF NOT EXISTS quota_mb      integer,
  ADD COLUMN IF NOT EXISTS priority      integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS dedupe_drive  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.storage_tier_policies.quota_mb IS
  'โควต้าพื้นที่ (MB) ที่บัคเก็ตนี้ถือครองใน Supabase ได้ ส่วนเกินจะถูกย้ายลง Google Drive';
COMMENT ON COLUMN public.storage_tier_policies.dedupe_drive IS
  'true = ถ้าไฟล์มีสำเนาบน Drive แล้ว ให้ลบสำเนาใน Supabase ทิ้ง (อ่านผ่าน Drive แทน)';

-- ---------------------------------------------------------------------------
-- สัดส่วนโควต้าตาม logic ของโรงเรียน (รวม ~700 MB จาก 1 GB, กันสำรอง 30%)
--   งานวิชาการ/หลักฐานการศึกษา  > งานสื่อการสอน > งานบันทึกภาพชั่วคราว
-- ---------------------------------------------------------------------------
INSERT INTO public.storage_tier_policies (bucket, enabled, older_than_days, keep_recent, quota_mb, priority, dedupe_drive, note) VALUES
  ('ar-media',           true,  30,  0, 150,  60, false, 'สื่อ AR — ไฟล์ใหญ่ ใช้เป็นครั้งคราว ย้ายลง Drive เมื่อเกินโควต้า'),
  ('line-vault',         true,   7,  0,  60,  20, true,  'คลัง LINE — Drive เป็นหลัก ลบสำเนาซ้ำใน Supabase'),
  ('padlet',             true, 120,  0,  40,  70, false, 'สื่อกระดาน Padlet'),
  ('padlet-media',       true, 120,  0,  40,  70, false, 'สื่อกระดาน Padlet (สาธารณะ)'),
  ('app-downloads',      true,  14,  2, 400,  10, false, 'ไฟล์ติดตั้งโปรแกรม เก็บล่าสุด 2 รุ่น'),
  ('attendance-photos',  true, 180,  0,  40,  40, false, 'ภาพประกอบการมาเรียน — ข้อมูลหลักอยู่ในตาราง attendance'),
  ('camera-events',      true,  30,  0,  20,  15, false, 'ภาพเหตุการณ์กล้อง — ชั่วคราว'),
  ('exam-scans',         true, 365,  0,  50,  80, false, 'ใบคำตอบสแกน — อ้างอิงงานวัดผล'),
  ('home-visit-photos',  true, 365,  0,  40,  85, false, 'ภาพเยี่ยมบ้าน — ระบบดูแลช่วยเหลือนักเรียน'),
  ('offsite-photos',     true, 365,  0,  30,  50, false, 'ภาพกิจกรรมนอกสถานที่'),
  ('chat-attachments',   true,  90,  0,  20,  25, false, 'ไฟล์แนบในแชท — ชั่วคราว'),
  ('ai-import-temp',     true,   7,  0,   5,   5, false, 'ไฟล์นำเข้าชั่วคราว'),
  ('wall-media',         true, 180,  0,  20,  45, false, 'สื่อบอร์ดประชาสัมพันธ์ภายใน'),
  ('learning-content',   true, 365,  0,  40,  90, false, 'สื่อการเรียนรู้'),
  ('portfolio',          true, 365,  0,  30,  75, false, 'แฟ้มสะสมผลงานนักเรียน'),
  ('homework-files',     true, 240,  0,  30,  35, false, 'ไฟล์งานที่มอบหมาย'),
  ('backups',            true,   3,  1,  10,   1, false, 'ไฟล์สำรอง — เก็บบน Drive เป็นหลัก')
ON CONFLICT (bucket) DO UPDATE SET
  enabled         = EXCLUDED.enabled,
  older_than_days = EXCLUDED.older_than_days,
  keep_recent     = EXCLUDED.keep_recent,
  quota_mb        = EXCLUDED.quota_mb,
  priority        = EXCLUDED.priority,
  dedupe_drive    = EXCLUDED.dedupe_drive,
  note            = EXCLUDED.note,
  updated_at      = now();

-- ---------------------------------------------------------------------------
-- กันไฟล์ใหญ่เกินจำเป็นตั้งแต่ต้นทาง (ลดโอกาสพื้นที่เต็ม)
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'ar-media'          AND coalesce(file_size_limit, 0) > 104857600;
UPDATE storage.buckets SET file_size_limit =  26214400 WHERE id IN ('padlet','padlet-media','wall-media','chat-attachments','homework-files','portfolio') AND file_size_limit IS DISTINCT FROM 26214400;
UPDATE storage.buckets SET file_size_limit =   5242880 WHERE id IN ('attendance-photos','face-photos','profile-images','asset-photos') AND file_size_limit IS DISTINCT FROM 5242880;
UPDATE storage.buckets SET file_size_limit =  20971520 WHERE id IN ('exam-scans','home-visit-photos','offsite-photos','leave-attachments') AND file_size_limit IS DISTINCT FROM 20971520;

-- ---------------------------------------------------------------------------
-- ตัดข้อมูลปฏิบัติการที่สะสมเกินจำเป็น (แจ้งเตือน/กล่องงาน/สุขภาพคีออส)
-- ข้อมูลหลักฐานทางการศึกษาไม่ถูกแตะต้อง — ควบคุมด้วย data_retention_policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_operational_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb := '{}'::jsonb;
  n bigint;
BEGIN
  DELETE FROM public.notifications WHERE created_at < now() - interval '120 days';
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('notifications', n);

  DELETE FROM public.inbox_items WHERE created_at < now() - interval '180 days';
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('inbox_items', n);

  DELETE FROM public.error_logs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('error_logs', n);

  DELETE FROM public.kiosk_health_samples WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('kiosk_health_samples', n);

  DELETE FROM public.rate_limit_logs WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('rate_limit_logs', n);

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_operational_data() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_operational_data() TO service_role;

-- cron: ตัดข้อมูลปฏิบัติการทุกคืน (02:30 เวลาไทย = 19:30 UTC)
SELECT cron.unschedule('prune-operational-data') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-operational-data');
SELECT cron.schedule('prune-operational-data', '30 19 * * *', $$SELECT public.prune_operational_data();$$);

-- cron: บังคับโควต้าพื้นที่ทุกคืน (03:10 เวลาไทย = 20:10 UTC)
SELECT cron.unschedule('storage-quota-enforce') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'storage-quota-enforce');
SELECT cron.schedule(
  'storage-quota-enforce',
  '10 20 * * *',
  $$SELECT public.cron_invoke('storage-tier', '{"action":"enforce","max_files":200}'::jsonb, 600000);$$
);
