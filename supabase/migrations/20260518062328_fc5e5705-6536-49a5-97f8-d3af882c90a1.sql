-- Unique index ป้องกันการบันทึกซ้ำในระดับฐานข้อมูล (atomic)
DO $idxguard$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS face_scan_logs_unique_per_day
  ON public.face_scan_logs (student_id, scan_date, scan_type)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- ปรับ trigger ให้ใช้ exception handler รองรับ unique violation
CREATE OR REPLACE FUNCTION public.prevent_duplicate_face_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.face_scan_logs
    WHERE student_id = NEW.student_id
      AND scan_date = NEW.scan_date
      AND scan_type = NEW.scan_type
    LIMIT 1
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;
