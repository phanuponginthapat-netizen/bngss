-- แก้ scan_date ให้เป็นวันที่ไทย (Asia/Bangkok) แทน CURRENT_DATE (UTC)
-- ป้องกันการนับวันผิดช่วง 00:00–06:59 ตามเวลาไทย

-- 1) เปลี่ยน default ให้เป็นวันที่ไทย
DO $guard$
BEGIN
  ALTER TABLE public.face_scan_logs
    ALTER COLUMN scan_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date);
EXCEPTION
  WHEN undefined_table OR undefined_column OR undefined_object THEN
    RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;

-- 2) ลบแถวซ้ำตามคีย์ (student_id, วันที่ไทย, scan_type) ก่อนแก้ข้อมูลเก่า
--    กัน unique index ชนเมื่อ scan_date ถูกย้ายมาอยู่วันไทยเดียวกัน
DO $guard$
BEGIN
  DELETE FROM public.face_scan_logs a
  USING public.face_scan_logs b
  WHERE a.id > b.id
    AND a.student_id = b.student_id
    AND a.scan_type = b.scan_type
    AND (a.scan_time AT TIME ZONE 'Asia/Bangkok')::date = (b.scan_time AT TIME ZONE 'Asia/Bangkok')::date;
EXCEPTION
  WHEN undefined_table OR undefined_column OR undefined_object THEN
    RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;

-- 3) แก้ scan_date ของข้อมูลเก่าให้ตรงกับเวลาสแกนจริงในโซนไทย
DO $guard$
BEGIN
  UPDATE public.face_scan_logs
  SET scan_date = (scan_time AT TIME ZONE 'Asia/Bangkok')::date
  WHERE scan_date IS DISTINCT FROM (scan_time AT TIME ZONE 'Asia/Bangkok')::date;
EXCEPTION
  WHEN undefined_table OR undefined_column OR undefined_object THEN
    RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;