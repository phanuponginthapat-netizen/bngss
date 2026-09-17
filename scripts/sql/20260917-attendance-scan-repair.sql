-- ============================================================
-- แก้ปัญหา "นักเรียนสแกนเข้าโรงเรียนแล้ว แต่ระบบขึ้นขาดเรียน"
-- รันบน Supabase ของโรงเรียน (gwmszzoqqxmejefhayqf)
-- ปลอดภัยต่อการรันซ้ำ (idempotent)
-- ============================================================

-- 1) ลบแถว attendance ที่ซ้ำ (เก็บแถวที่สถานะดีที่สุด/ใหม่ที่สุด)
--    ต้องทำก่อน เพราะ unique index จะสร้างไม่ได้ถ้ามีข้อมูลซ้ำ
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, attendance_date,
                        COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid)
           ORDER BY CASE status WHEN 'present' THEN 5 WHEN 'late' THEN 4
                                WHEN 'leave' THEN 3 WHEN 'sick' THEN 2 ELSE 1 END DESC,
                    created_at DESC
         ) AS rn
  FROM public.attendance
)
DELETE FROM public.attendance a USING ranked r
WHERE a.id = r.id AND r.rn > 1;

-- 2) unique index ที่ trigger ต้องใช้ (ถ้าไม่มี → ON CONFLICT ล้มเหลว → ไม่มีบันทึกมาเรียน)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_per_day_subject
  ON public.attendance (student_id, attendance_date,
    COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 3) วันที่สแกนต้องอิงเวลาไทยเสมอ (กันกรณีสแกนก่อน 07:00 น. แล้วถูกบันทึกเป็นเมื่อวาน)
ALTER TABLE public.face_scan_logs
  ALTER COLUMN scan_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date);

CREATE OR REPLACE FUNCTION public.normalize_face_scan_date()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  NEW.scan_time := COALESCE(NEW.scan_time, now());
  NEW.scan_date := (NEW.scan_time AT TIME ZONE 'Asia/Bangkok')::date;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_normalize_face_scan_date ON public.face_scan_logs;
CREATE TRIGGER trg_normalize_face_scan_date
  BEFORE INSERT ON public.face_scan_logs
  FOR EACH ROW EXECUTE FUNCTION public.normalize_face_scan_date();

-- 4) เขียน trigger บันทึกมาเรียนใหม่ — ไม่กลืน error เงียบ ๆ แต่ log ไว้ใน error_logs
CREATE OR REPLACE FUNCTION public.auto_attendance_on_face_scan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur_year INT; cur_sem INT; bkk timestamp; scan_t time;
  st text := 'present'; v_school uuid; v_date date;
BEGIN
  IF NEW.scan_type NOT IN ('entry','assembly') THEN RETURN NEW; END IF;

  bkk    := (COALESCE(NEW.scan_time, NEW.created_at, now()) AT TIME ZONE 'Asia/Bangkok');
  scan_t := bkk::time;
  v_date := COALESCE(NEW.scan_date, bkk::date);

  SELECT (ap.academic_year_be - 543), ap.semester INTO cur_year, cur_sem
  FROM public.academic_periods ap WHERE ap.is_current = true LIMIT 1;

  IF cur_year IS NULL THEN
    cur_year := CASE WHEN EXTRACT(month FROM bkk)::int >= 5
                     THEN EXTRACT(year FROM bkk)::int ELSE EXTRACT(year FROM bkk)::int - 1 END;
    cur_sem  := CASE WHEN EXTRACT(month FROM bkk)::int BETWEEN 5 AND 10 THEN 1 ELSE 2 END;
  END IF;

  IF scan_t > time '08:30' THEN st := 'late'; END IF;

  SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.student_id;

  INSERT INTO public.attendance (
    student_id, attendance_date, status, subject_id,
    academic_year, semester, recorded_by, notes, school_id
  ) VALUES (
    NEW.student_id, v_date, st, NULL, cur_year, cur_sem, NEW.scanned_by,
    CASE WHEN NEW.entry_method = 'qr' THEN 'qr-scan' ELSE 'face-scan' END,
    COALESCE(v_school, NEW.school_id)
  )
  ON CONFLICT (student_id, attendance_date,
               COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    status = CASE WHEN attendance.status IS NULL OR attendance.status IN ('absent','')
                  THEN EXCLUDED.status ELSE attendance.status END,
    academic_year = COALESCE(attendance.academic_year, EXCLUDED.academic_year),
    semester      = COALESCE(attendance.semester, EXCLUDED.semester),
    notes  = COALESCE(attendance.notes, EXCLUDED.notes),
    school_id = COALESCE(attendance.school_id, EXCLUDED.school_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.error_logs (source, message, context)
    VALUES ('auto_attendance_on_face_scan', SQLERRM,
            jsonb_build_object('student_id', NEW.student_id, 'scan_date', NEW.scan_date));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_attendance_on_face_scan ON public.face_scan_logs;
CREATE TRIGGER trg_auto_attendance_on_face_scan
  AFTER INSERT ON public.face_scan_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_attendance_on_face_scan();

-- 5) ซ่อมข้อมูลย้อนหลัง 180 วัน: ทุกการสแกนเข้าต้องมีบันทึก "มาเรียน/สาย"
WITH scans AS (
  SELECT DISTINCT ON (f.student_id, f.scan_date)
    f.student_id, f.scan_date,
    CASE WHEN (COALESCE(f.scan_time, f.created_at) AT TIME ZONE 'Asia/Bangkok')::time > time '08:30'
         THEN 'late' ELSE 'present' END AS st,
    CASE WHEN f.entry_method = 'qr' THEN 'qr-scan' ELSE 'face-scan' END AS note,
    f.scanned_by
  FROM public.face_scan_logs f
  WHERE f.scan_type IN ('entry','assembly')
    AND f.scan_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date - 180
  ORDER BY f.student_id, f.scan_date, COALESCE(f.scan_time, f.created_at)
)
-- 5.1 แก้แถวที่ขึ้น "ขาด" ทั้งที่มีการสแกน
UPDATE public.attendance a
SET status = s.st, notes = COALESCE(a.notes, s.note)
FROM scans s
WHERE a.student_id = s.student_id
  AND a.attendance_date = s.scan_date
  AND a.subject_id IS NULL
  AND (a.status IS NULL OR a.status IN ('absent',''));

WITH scans AS (
  SELECT DISTINCT ON (f.student_id, f.scan_date)
    f.student_id, f.scan_date,
    CASE WHEN (COALESCE(f.scan_time, f.created_at) AT TIME ZONE 'Asia/Bangkok')::time > time '08:30'
         THEN 'late' ELSE 'present' END AS st,
    CASE WHEN f.entry_method = 'qr' THEN 'qr-scan' ELSE 'face-scan' END AS note,
    f.scanned_by
  FROM public.face_scan_logs f
  WHERE f.scan_type IN ('entry','assembly')
    AND f.scan_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date - 180
  ORDER BY f.student_id, f.scan_date, COALESCE(f.scan_time, f.created_at)
)
-- 5.2 เพิ่มแถวที่หายไปทั้งแถว
INSERT INTO public.attendance (
  student_id, attendance_date, status, subject_id,
  academic_year, semester, recorded_by, notes, school_id
)
SELECT s.student_id, s.scan_date, s.st, NULL,
  CASE WHEN EXTRACT(month FROM s.scan_date)::int >= 5
       THEN EXTRACT(year FROM s.scan_date)::int ELSE EXTRACT(year FROM s.scan_date)::int - 1 END,
  CASE WHEN EXTRACT(month FROM s.scan_date)::int BETWEEN 5 AND 10 THEN 1 ELSE 2 END,
  s.scanned_by, s.note, st2.school_id
FROM scans s
JOIN public.students st2 ON st2.id = s.student_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.attendance a
  WHERE a.student_id = s.student_id AND a.attendance_date = s.scan_date AND a.subject_id IS NULL
)
ON CONFLICT DO NOTHING;
