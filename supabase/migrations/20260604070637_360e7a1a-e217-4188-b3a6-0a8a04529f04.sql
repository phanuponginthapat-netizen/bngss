-- Sync face_scan_logs → attendance (assembly = subject_id NULL)
DROP FUNCTION IF EXISTS public.sync_face_scan_to_attendance() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_face_scan_to_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
  v_local_time time;
  v_status text;
  v_year int;
  v_sem int;
  v_school uuid;
BEGIN
  IF NEW.student_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.scan_type IS DISTINCT FROM 'entry' THEN RETURN NEW; END IF;

  v_date := (NEW.created_at AT TIME ZONE 'Asia/Bangkok')::date;
  v_local_time := (NEW.created_at AT TIME ZONE 'Asia/Bangkok')::time;
  v_status := CASE WHEN v_local_time > time '08:30' THEN 'late' ELSE 'present' END;

  -- compute academic year/semester (CE convention)
  v_year := EXTRACT(YEAR FROM v_date)::int
            + CASE WHEN EXTRACT(MONTH FROM v_date)::int >= 5 THEN 0 ELSE -1 END;
  v_sem := CASE WHEN EXTRACT(MONTH FROM v_date)::int BETWEEN 5 AND 10 THEN 1 ELSE 2 END;

  SELECT school_id INTO v_school FROM public.students WHERE id = NEW.student_id;

  -- Upsert using the functional unique index
  INSERT INTO public.attendance (
    student_id, attendance_date, subject_id, status,
    academic_year, semester, recorded_by, notes, school_id
  ) VALUES (
    NEW.student_id, v_date, NULL, v_status,
    v_year, v_sem, NEW.scanned_by, 'face-scan', v_school
  )
  ON CONFLICT (student_id, attendance_date, (COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  DO UPDATE SET
    status = CASE
      WHEN public.attendance.status IN ('absent') THEN EXCLUDED.status
      WHEN public.attendance.status = 'leave' THEN public.attendance.status  -- keep leave
      ELSE public.attendance.status
    END,
    notes = COALESCE(public.attendance.notes, EXCLUDED.notes);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'sync_face_scan_to_attendance failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_face_scan_to_attendance ON public.face_scan_logs';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE TRIGGER trg_sync_face_scan_to_attendance
    AFTER INSERT ON public.face_scan_logs
    FOR EACH ROW EXECUTE FUNCTION public.sync_face_scan_to_attendance()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
