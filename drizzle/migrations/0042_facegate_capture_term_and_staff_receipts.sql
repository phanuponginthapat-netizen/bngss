CREATE OR REPLACE FUNCTION public.auto_attendance_on_face_scan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur_year int; cur_sem int; captured timestamp; scan_day date; st text := 'present';
  v_school uuid; threshold_text text; late_cutoff time;
BEGIN
  IF NEW.scan_type NOT IN ('entry','assembly') THEN RETURN NEW; END IF;
  captured := COALESCE(NEW.scan_time, NEW.created_at, now()) AT TIME ZONE 'Asia/Bangkok';
  scan_day := captured::date;
  SELECT academic_year_be - 543, semester INTO cur_year, cur_sem
  FROM public.academic_periods
  WHERE start_date <= scan_day AND end_date >= scan_day
  ORDER BY start_date DESC LIMIT 1;
  IF cur_year IS NULL THEN
    RAISE LOG 'FaceGate attendance calendar unavailable for scan date %', scan_day;
    RETURN NEW;
  END IF;
  SELECT setting_value #>> '{}' INTO threshold_text FROM public.school_settings WHERE setting_key='clock_late_threshold' LIMIT 1;
  threshold_text := COALESCE(NULLIF(threshold_text,''),'08:30');
  IF threshold_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
    RAISE LOG 'FaceGate attendance late threshold unavailable'; RETURN NEW;
  END IF;
  late_cutoff := threshold_text::time;
  IF captured::time > late_cutoff THEN st := 'late'; END IF;
  SELECT school_id INTO v_school FROM public.students WHERE id=NEW.student_id;
  INSERT INTO public.attendance(student_id,attendance_date,status,subject_id,academic_year,semester,recorded_by,notes,school_id)
  VALUES(NEW.student_id,scan_day,st,NULL,cur_year,cur_sem,NEW.scanned_by,
    CASE WHEN NEW.entry_method='qr' THEN 'qr-scan' ELSE 'face-scan' END,COALESCE(v_school,NEW.school_id))
  ON CONFLICT (student_id,attendance_date,COALESCE(subject_id,'00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'FaceGate attendance bookkeeping failed: %',SQLERRM;
  RETURN NEW;
END;
$$;