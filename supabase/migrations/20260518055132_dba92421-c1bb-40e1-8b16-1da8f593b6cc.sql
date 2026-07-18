CREATE OR REPLACE FUNCTION public.auto_attendance_on_face_scan()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cur_year INT;
  cur_sem INT;
BEGIN
  IF NEW.scan_type NOT IN ('entry','assembly') THEN
    RETURN NEW;
  END IF;

  cur_year := EXTRACT(year FROM now())::int;
  cur_sem := CASE WHEN EXTRACT(month FROM now())::int BETWEEN 5 AND 10 THEN 1 ELSE 2 END;

  INSERT INTO public.attendance (student_id, attendance_date, status, subject_id, academic_year, semester, recorded_by, notes)
  VALUES (NEW.student_id, NEW.scan_date, 'present', NULL, cur_year, cur_sem, NEW.scanned_by, 'face-scan')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;