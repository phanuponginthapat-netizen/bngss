DROP TRIGGER IF EXISTS trg_auto_attendance_on_face_scan ON public.face_scan_logs;
CREATE TRIGGER trg_auto_attendance_on_face_scan AFTER INSERT ON public.face_scan_logs FOR EACH ROW EXECUTE FUNCTION public.auto_attendance_on_face_scan();

DROP TRIGGER IF EXISTS trg_notify_on_face_scan ON public.face_scan_logs;
CREATE TRIGGER trg_notify_on_face_scan AFTER INSERT ON public.face_scan_logs FOR EACH ROW EXECUTE FUNCTION public.notify_on_face_scan();

DROP TRIGGER IF EXISTS trg_sync_notification_to_inbox ON public.notifications;
CREATE TRIGGER trg_sync_notification_to_inbox AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.sync_notification_to_inbox();

DROP TRIGGER IF EXISTS trg_prevent_sensitive_profile_self_update ON public.profiles;
CREATE TRIGGER trg_prevent_sensitive_profile_self_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_sensitive_profile_self_update();

DROP TRIGGER IF EXISTS trg_personnel_block_sensitive_self_update ON public.personnel;
CREATE TRIGGER trg_personnel_block_sensitive_self_update BEFORE UPDATE ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.personnel_block_sensitive_self_update();

DROP TRIGGER IF EXISTS trg_prevent_personnel_self_escalation ON public.personnel;
CREATE TRIGGER trg_prevent_personnel_self_escalation BEFORE UPDATE ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.prevent_personnel_self_escalation();

CREATE OR REPLACE FUNCTION public.calculate_late_minutes(_student_id uuid, _attendance_date date, _scan_time timestamptz)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE _start time; _late int;
BEGIN
  IF _scan_time IS NULL THEN RETURN NULL; END IF;
  SELECT sc.start_time INTO _start
  FROM public.schedules sc
  JOIN public.students s ON s.classroom_id = sc.classroom_id
  WHERE s.id = _student_id AND sc.day_of_week = EXTRACT(DOW FROM _attendance_date)::int
  ORDER BY sc.start_time LIMIT 1;
  _start := COALESCE(_start, time '08:30');
  _late := GREATEST(0, (EXTRACT(EPOCH FROM ((_scan_time AT TIME ZONE 'Asia/Bangkok')::time - _start)) / 60)::int);
  RETURN _late;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $fn$;

CREATE OR REPLACE FUNCTION public.auto_set_late_minutes()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE v_scan timestamptz;
BEGIN
  IF NEW.status = 'late' AND NEW.late_minutes IS NULL THEN
    SELECT COALESCE(l.scan_time, l.created_at) INTO v_scan
    FROM public.face_scan_logs l
    WHERE l.student_id = NEW.student_id AND l.scan_date = NEW.attendance_date
    ORDER BY l.scan_time NULLS LAST LIMIT 1;
    NEW.late_minutes := public.calculate_late_minutes(NEW.student_id, NEW.attendance_date, v_scan);
  END IF;
  IF NEW.status <> 'late' THEN NEW.late_minutes := NULL; END IF;
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.notify_parent_on_absence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  parent_id uuid; student_name text; st text;
  supabase_url text; cron_secret text; payload jsonb; http_result record;
BEGIN
  st := NEW.status;
  IF st NOT IN ('absent','late') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT s.parent_user_id, (s.first_name || ' ' || s.last_name)
    INTO parent_id, student_name FROM public.students s WHERE s.id = NEW.student_id;
  IF parent_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, is_read)
  VALUES (parent_id, '📋 แจ้งเตือนการมาเรียน',
    student_name || ' — ' || CASE WHEN st='late' THEN 'มาสาย' ELSE 'ขาดเรียน' END || ' วันที่ ' || NEW.attendance_date::text,
    'attendance', NEW.id, 'attendance', false);
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
    cron_secret  := current_setting('app.settings.cron_secret', true);
    IF COALESCE(supabase_url,'') <> '' AND COALESCE(cron_secret,'') <> '' THEN
      payload := jsonb_build_object('attendance_date', NEW.attendance_date::text,
        'absent_students', jsonb_build_array(jsonb_build_object(
          'student_id', NEW.student_id::text, 'student_name', student_name, 'status', st)));
      SELECT * INTO http_result FROM net.http_post(
        url := supabase_url || '/functions/v1/notify-parent-absence',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',cron_secret),
        body := payload::text, timeout_milliseconds := 5000);
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE LOG 'notify_parent_on_absence: %', SQLERRM;
  END;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_parent_on_absence failed: %', SQLERRM;
  RETURN NEW;
END $fn$;