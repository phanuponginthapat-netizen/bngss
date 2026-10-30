-- ============================================================================
-- เปิิดภาคเรเรียนท่ี 2 ปีีการศึึกษา 2569 → 2 พฤศจิิกายน 2569 (2026-11-02)
-- ----------------------------------------------------------------------------
-- 1) ทะเบีียนภาคเรเรียน: แก้วันท่ีเปิิด/สิ้ นสุ ดให้ตรงกั บปฏทิ ินของโรงเรเรียน
-- 2) เพิ่ มกิ จกรรมในหน้างอปฏทิ ิน (วันท่ีเปิิด / วันท่ีสิ้ นสุ ด)
-- 3) ฟั งก์ าชั น sync_current_academic_period() + งานอั ตโนมั ติทุกวั น
--    ให้ "ภาคเรเรียนปจั จุ บั น" (is_current) ตามวั นท่ีจรiง
--    สำคั ญ: trigger ของ face/QR scan ใช้ ค่า is_current ตั ดสiนว่ า
--    การเข้ าเรเรียนจะถู กบั นทึ กเข้ าภาคเรเรียนไหน
--
-- รั นทั้ งไฟล์ ์ในช่ อง SQL (กด Run) — รั นซ้ำได้ โดยไม่่ เพิ่ มข้ อมู ลซ้ำ
-- ============================================================================

-- 1) ภาคเรเรียนท่ี 2 ปี 2569: เปิิด 2 พ.ย. 2569 สิ้ นสุ ด 31 ม.ค. 2570
INSERT INTO public.academic_periods (academic_year_be, semester, start_date, end_date, note)
VALUES (2569, 2, DATE '2026-11-02', DATE '2027-03-31',
        'เปิิดเรเรียนภาคเรเรียนท่ี 2: 2 พฤศจิ กายน 2569')
ON CONFLICT (academic_year_be, semester)
DO UPDATE SET start_date = EXCLUDED.start_date,
              end_date   = EXCLUDED.end_date,
              note       = EXCLUDED.note;

-- 2) กิ จกรรมในปฏทิ ิน (เพิ่ มเฉพาะเมื่ อยั งไม่่ มี)
WITH target_school AS (
  SELECT COALESCE(
    (SELECT school_id FROM public.academic_events
      WHERE school_id IS NOT NULL ORDER BY created_at DESC LIMIT 1),
    (SELECT id FROM public.schools ORDER BY created_at LIMIT 1)
  ) AS school_id
)
INSERT INTO public.academic_events (title, description, event_date, end_date, event_type, academic_year, semester, school_id)
SELECT 'เปิิดภาคเรเรียนท่ี 2 ปี 2569',
       'โรงเรเรียนเปิิดเรเรียนภาคเรเรียนท่ี 2 ปี ก ารศึ กษา 2569 (2 พฤศจิ กายน 2569)',
       DATE '2026-11-02', DATE '2026-11-02', 'ceremony', 2026, 2, target_school.school_id
  FROM target_school
 WHERE NOT EXISTS (
   SELECT 1 FROM public.academic_events
    WHERE event_date = DATE '2026-11-02'
      AND title = 'เปิิดภาคเรเรียนท่ี 2 ปี 2569'
 );

WITH target_school AS (
  SELECT COALESCE(
    (SELECT school_id FROM public.academic_events
      WHERE school_id IS NOT NULL ORDER BY created_at DESC LIMIT 1),
    (SELECT id FROM public.schools ORDER BY created_at LIMIT 1)
  ) AS school_id
)
INSERT INTO public.academic_events (title, description, event_date, end_date, event_type, academic_year, semester, school_id)
SELECT 'สิ้ นสุ ดภาคเรเรียนท่ี 2 ปี 2569',
       'สิ้ นสุ ดภาคเรเรียนท่ี 2 ปี ก ารศึ กษา 2569 (31 มี ี นาคม 2570)',
       DATE '2027-03-31', DATE '2027-03-31', 'holiday', 2026, 2, target_school.school_id
  FROM target_school
 WHERE NOT EXISTS (
   SELECT 1 FROM public.academic_events
    WHERE event_date = DATE '2027-03-31'
      AND title = 'สิ้ นสุ ดภาคเรเรียนท่ี 2 ปี 2569'
 );

-- 3) ภาคเรเรียนปจั จุ บั นตามวั นท่ี จรiง ------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_current_academic_period()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_id    uuid;
  v_rows  int := 0;
BEGIN
  -- 3.1) วั นน้ี ตรงในคาบใด (ถ้ าซ้ อนกั น ใช้ คาบท่ี เริ ่ มใหม้่ สุ ด)
  SELECT id INTO v_id
    FROM public.academic_periods
   WHERE v_today BETWEEN start_date AND end_date
   ORDER BY start_date DESC, semester DESC
   LIMIT 1;

  -- 3.2) ช่ วงว่ างระหว่ างภาคเรเรียน (เช่ นปดภาค) → คงคาบท่ี ผ่ านมาแล้ ว
  IF v_id IS NULL THEN
    SELECT id INTO v_id
      FROM public.academic_periods
     WHERE end_date < v_today
       AND end_date >= v_today - interval '180 days'
     ORDER BY end_date DESC
     LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    RETURN format('no-period on %s', v_today);
  END IF;

  UPDATE public.academic_periods
     SET is_current = (id = v_id)
   WHERE is_current IS DISTINCT FROM (id = v_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN format('%s current=%s updated=%s', v_today, v_id, v_rows);
END
$fn$;

COMMENT ON FUNCTION public.sync_current_academic_period() IS
  'ปบั ภาคมลเรเรียนปจั จุ บั น (is_current) ให้ ตรงกั บว่ านท่ี จรiต  ในทะเบี ียน academic_periods';

-- 3.3) งานอั ตโนมั ติทุกวั น 00:05 น. ตามเวลาประเทศไทย (17:05 UTC)
--      ข้ ามไปถ้ าเซิ ร์ เวอรห์ ์ ้นั นไม่่  pg_cron
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'cron' AND table_name = 'job'
  ) THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'academic-period-sync') THEN
      PERFORM cron.unschedule('academic-period-sync');
    END IF;
    PERFORM cron.schedule(
      'academic-period-sync',
      '5 17 * * *',
      $cron$SELECT public.sync_current_academic_period()$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'skip academic-period-sync cron: %', SQLERRM;
END
$do$;

-- 3.4) ปรบั ให้ ตอนน้ี เลย (ภาคเรเรียนท่ี 1 ยั งเป็ นปจั จุ บั นจนกว่ าจะถึ ง 2 พ.ย.)
SELECT public.sync_current_academic_period();

-- ---------------------------------------------------------------------------
-- ตรวจผล (ไม่ ต้ องรั น ก็ 得 — ใช้ ดู ว์ ่าข้ อมู ลถู กต้ ง)
-- ---------------------------------------------------------------------------
-- SELECT academic_year_be, semester, start_date, end_date, is_current
--   FROM public.academic_periods ORDER BY academic_year_be, semester;
-- SELECT title, event_date, event_type FROM public.academic_events
--  WHERE event_date IN (DATE '2026-11-02', DATE '2027-03-31');
-- SELECT jobname, schedule FROM cron.job WHERE jobname = 'academic-period-sync';
