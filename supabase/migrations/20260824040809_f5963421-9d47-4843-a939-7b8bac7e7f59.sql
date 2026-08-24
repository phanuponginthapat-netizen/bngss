-- 1) Remove the broken/duplicate sync trigger (its ON CONFLICT DO UPDATE used an
--    invalid "public.attendance.col" qualification, so it always failed silently)
DROP TRIGGER IF EXISTS trg_sync_face_scan_to_attendance ON public.face_scan_logs;
DROP FUNCTION IF EXISTS public.sync_face_scan_to_attendance();

-- 2) Remove duplicate school_id fill trigger
DROP TRIGGER IF EXISTS trg_face_scan_school_id ON public.face_scan_logs;

-- 3) Robust single attendance writer
CREATE OR REPLACE FUNCTION public.auto_attendance_on_face_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_year INT;
  cur_sem  INT;
  bkk      timestamp;
  scan_t   time;
  st       text := 'present';
  v_school uuid;
BEGIN
  IF NEW.scan_type NOT IN ('entry','assembly') THEN
    RETURN NEW;
  END IF;

  bkk    := (COALESCE(NEW.scan_time, NEW.created_at, now()) AT TIME ZONE 'Asia/Bangkok');
  scan_t := bkk::time;

  SELECT (ap.academic_year_be - 543), ap.semester
    INTO cur_year, cur_sem
  FROM public.academic_periods ap
  WHERE ap.is_current = true
  LIMIT 1;

  IF cur_year IS NULL THEN
    cur_year := CASE WHEN EXTRACT(month FROM bkk)::int >= 5
                     THEN EXTRACT(year FROM bkk)::int
                     ELSE EXTRACT(year FROM bkk)::int - 1 END;
    cur_sem  := CASE WHEN EXTRACT(month FROM bkk)::int BETWEEN 5 AND 10 THEN 1 ELSE 2 END;
  END IF;

  IF scan_t > time '08:30' THEN st := 'late'; END IF;

  SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.student_id;

  INSERT INTO public.attendance (
    student_id, attendance_date, status, subject_id,
    academic_year, semester, recorded_by, notes, school_id
  ) VALUES (
    NEW.student_id, COALESCE(NEW.scan_date, bkk::date), st, NULL,
    cur_year, cur_sem, NEW.scanned_by,
    CASE WHEN NEW.entry_method = 'qr' THEN 'qr-scan' ELSE 'face-scan' END,
    COALESCE(v_school, NEW.school_id)
  )
  ON CONFLICT (student_id, attendance_date, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    status = CASE WHEN attendance.status IS NULL OR attendance.status IN ('absent','')
                  THEN EXCLUDED.status ELSE attendance.status END,
    notes  = COALESCE(attendance.notes, EXCLUDED.notes),
    school_id = COALESCE(attendance.school_id, EXCLUDED.school_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never let attendance bookkeeping block the scan itself
  RAISE LOG 'auto_attendance_on_face_scan failed for student %: %', NEW.student_id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 4) Backfill attendance for past scans that never produced a record
INSERT INTO public.attendance (
  student_id, attendance_date, status, subject_id,
  academic_year, semester, recorded_by, notes, school_id
)
SELECT DISTINCT ON (f.student_id, f.scan_date)
  f.student_id,
  f.scan_date,
  CASE WHEN (COALESCE(f.scan_time, f.created_at) AT TIME ZONE 'Asia/Bangkok')::time > time '08:30'
       THEN 'late' ELSE 'present' END,
  NULL,
  CASE WHEN EXTRACT(month FROM (COALESCE(f.scan_time, f.created_at) AT TIME ZONE 'Asia/Bangkok'))::int >= 5
       THEN EXTRACT(year FROM (COALESCE(f.scan_time, f.created_at) AT TIME ZONE 'Asia/Bangkok'))::int
       ELSE EXTRACT(year FROM (COALESCE(f.scan_time, f.created_at) AT TIME ZONE 'Asia/Bangkok'))::int - 1 END,
  CASE WHEN EXTRACT(month FROM (COALESCE(f.scan_time, f.created_at) AT TIME ZONE 'Asia/Bangkok'))::int BETWEEN 5 AND 10
       THEN 1 ELSE 2 END,
  f.scanned_by,
  CASE WHEN f.entry_method = 'qr' THEN 'qr-scan' ELSE 'face-scan' END,
  s.school_id
FROM public.face_scan_logs f
JOIN public.students s ON s.id = f.student_id
WHERE f.scan_type IN ('entry','assembly')
  AND NOT EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.student_id = f.student_id
      AND a.attendance_date = f.scan_date
      AND a.subject_id IS NULL
  )
ORDER BY f.student_id, f.scan_date, f.scan_time
ON CONFLICT (student_id, attendance_date, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO NOTHING;