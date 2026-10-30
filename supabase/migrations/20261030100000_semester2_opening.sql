-- ============================================================================
-- Academic year 2569 (2026 CE): semester 2 opens on 2 November 2026
-- ----------------------------------------------------------------------------
-- 1) Correct the opening day without changing the registered closing day.
-- 2) Put the opening day on the school calendar in Thai.
-- 3) Create sync_current_academic_period() plus a daily job so the flag
--    is_current always follows the real date. This matters because the
--    face / QR scan trigger reads is_current to decide which semester an
--    attendance row belongs to.
--
-- Run the whole file in the SQL box (press Run). Safe to run again:
-- nothing is duplicated and no existing data is deleted.
-- ============================================================================

-- 1) Semester 2 of academic year 2569
INSERT INTO public.academic_periods (academic_year_be, semester, start_date, end_date, note)
VALUES (2569, 2, DATE '2026-11-02', DATE '2027-03-31',
        'เปิดภาคเรียนที่ 2 วันที่ 2 พฤศจิกายน 2569')
ON CONFLICT (academic_year_be, semester)
DO UPDATE SET start_date = EXCLUDED.start_date,
              note       = EXCLUDED.note;

-- 2) Calendar entries (inserted only when missing)
WITH target_school AS (
  SELECT COALESCE(
    (SELECT school_id FROM public.academic_events
      WHERE school_id IS NOT NULL ORDER BY created_at DESC LIMIT 1),
    (SELECT id FROM public.schools ORDER BY created_at LIMIT 1)
  ) AS school_id
)
INSERT INTO public.academic_events
       (title, description, event_date, end_date, event_type, academic_year, semester, school_id)
SELECT 'เปิดภาคเรียนที่ 2 ปี 2569',
       'เปิดเรียนภาคเรียนที่ 2 ปีการศึกษา 2569 วันที่ 2 พฤศจิกายน 2569',
       DATE '2026-11-02', DATE '2026-11-02', 'ceremony', 2026, 2, target_school.school_id
  FROM target_school
 WHERE NOT EXISTS (
   SELECT 1 FROM public.academic_events
    WHERE event_date = DATE '2026-11-02'
      AND academic_year = 2026 AND semester = 2
      AND title IN ('Semester 2 opens', 'เปิดภาคเรียนที่ 2 ปี 2569')
 );

UPDATE public.academic_events
   SET title = 'เปิดภาคเรียนที่ 2 ปี 2569',
       description = 'เปิดเรียนภาคเรียนที่ 2 ปีการศึกษา 2569 วันที่ 2 พฤศจิกายน 2569'
 WHERE title = 'Semester 2 opens' AND event_date = DATE '2026-11-02'
   AND academic_year = 2026 AND semester = 2;

-- 3) Keep is_current in step with the real date ----------------------------
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
  -- 3.1) today falls inside a registered term (the newest one wins)
  SELECT id INTO v_id
    FROM public.academic_periods
   WHERE v_today BETWEEN start_date AND end_date
   ORDER BY start_date DESC, semester DESC
   LIMIT 1;

  -- 3.2) in the gap between terms (e.g. after a term closed): keep the term
  --      that just ended as the current one, for up to 180 days
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

  -- Clear first: the existing single-current trigger updates sibling rows.
  UPDATE public.academic_periods
     SET is_current = false WHERE id <> v_id AND is_current = true;
  UPDATE public.academic_periods
     SET is_current = true WHERE id = v_id AND is_current IS DISTINCT FROM true;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN format('%s current=%s updated=%s', v_today, v_id, v_rows);
END
$fn$;

COMMENT ON FUNCTION public.sync_current_academic_period() IS
  'Point academic_periods.is_current at the term that matches today (Asia/Bangkok).';
REVOKE ALL ON FUNCTION public.sync_current_academic_period() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_current_academic_period() TO service_role;

-- 3.3) daily job at 00:00 Thailand time (17:00 UTC).
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
      '0 17 * * *',
      $cron$SELECT public.sync_current_academic_period()$cron$
    );
  ELSE
    RAISE EXCEPTION 'pg_cron is required for automatic term changes';
  END IF;
END
$do$;

-- 3.4) apply right now (semester 1 stays current until 2 Nov 2026)
SELECT public.sync_current_academic_period();

-- ---------------------------------------------------------------------------
-- Check the result (optional)
-- ---------------------------------------------------------------------------
-- SELECT academic_year_be, semester, start_date, end_date, is_current
--   FROM public.academic_periods ORDER BY academic_year_be, semester;
-- SELECT title, event_date, event_type FROM public.academic_events
--  WHERE event_date IN (DATE '2026-11-02', DATE '2027-03-31');
-- SELECT jobname, schedule FROM cron.job WHERE jobname = 'academic-period-sync';
