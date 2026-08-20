CREATE OR REPLACE FUNCTION public.auto_attendance_on_face_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cur_year INT;
  cur_sem INT;
  bkk timestamp;
  scan_t time;
  st text := 'present';
BEGIN
  IF NEW.scan_type NOT IN ('entry','assembly') THEN
    RETURN NEW;
  END IF;

  bkk := (COALESCE(NEW.scan_time, now()) AT TIME ZONE 'Asia/Bangkok');
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
    cur_sem := CASE WHEN EXTRACT(month FROM bkk)::int BETWEEN 5 AND 10 THEN 1 ELSE 2 END;
  END IF;

  IF scan_t > time '08:30' THEN st := 'late'; END IF;

  INSERT INTO public.attendance (student_id, attendance_date, status, subject_id, academic_year, semester, recorded_by, notes)
  VALUES (NEW.student_id, NEW.scan_date, st, NULL, cur_year, cur_sem, NEW.scanned_by,
          CASE WHEN NEW.entry_method = 'qr' THEN 'qr-scan' ELSE 'face-scan' END)
  ON CONFLICT (student_id, attendance_date, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET status = CASE WHEN attendance.status IS NULL OR attendance.status IN ('absent','')
                              THEN EXCLUDED.status ELSE attendance.status END;

  RETURN NEW;
END $function$;

DROP FUNCTION IF EXISTS public.resolve_scanned_personnel(text);
CREATE FUNCTION public.resolve_scanned_personnel(_input text)
RETURNS TABLE(id uuid, employee_code text, prefix text, first_name text, last_name text, position_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH raw AS (
    SELECT btrim(regexp_replace(COALESCE(_input,''), '^.*[/=]', '')) AS code,
           btrim(COALESCE(_input,'')) AS full_txt
  )
  SELECT p.id, p.employee_code, p.prefix, p.first_name, p.last_name, p."position"
  FROM public.personnel p, raw r
  WHERE (
        (p.employee_code IS NOT NULL AND (p.employee_code = r.code OR p.employee_code = r.full_txt))
     OR (r.code ~ '^[0-9a-fA-F-]{36}$' AND (p.id::text = r.code OR p.user_id::text = r.code))
     OR (r.full_txt ~ '^[0-9a-fA-F-]{36}$' AND (p.id::text = r.full_txt OR p.user_id::text = r.full_txt))
  )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_scanned_personnel(text) TO authenticated, anon, service_role;