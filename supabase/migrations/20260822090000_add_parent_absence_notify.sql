-- notify_parent_on_absence: trigger function + trigger
-- Fires after INSERT OR UPDATE on attendance for absent/late rows.
-- Inserts in-app notification and optionally calls the notify-parent-absence edge function via pg_net.

CREATE OR REPLACE FUNCTION public.notify_parent_on_absence()
RETURNS trigger AS $$
DECLARE
  parent_id uuid;
  student_name text;
  st text;
  supabase_url text;
  cron_secret text;
  payload jsonb;
  http_result record;
BEGIN
  st := NEW.status;
  IF st NOT IN ('absent', 'late') THEN RETURN NEW; END IF;

  SELECT s.parent_user_id, (s.first_name || ' ' || s.last_name)
  INTO parent_id, student_name
  FROM public.students s WHERE s.id = NEW.student_id;

  IF parent_id IS NULL THEN RETURN NEW; END IF;

  -- 1) In-app notification
  INSERT INTO public.notifications (user_id, title, body, type, severity, url, read)
  VALUES (
    parent_id,
    '📋 แจ้งเตือนการขาดเรียน',
    student_name || ' — ' || CASE WHEN st = 'late' THEN 'มาสาย' ELSE 'ขาดเรียน' END || ' วันที่ ' || NEW.attendance_date::text,
    'attendance_absent',
    'warning',
    '/dashboard/parent/attendance',
    false
  );

  -- 2) HTTP POST to notify-parent-absence edge function (pg_net, best-effort)
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
    cron_secret := current_setting('app.settings.cron_secret', true);

    IF supabase_url IS NOT NULL AND supabase_url != '' AND cron_secret IS NOT NULL AND cron_secret != '' THEN
      payload := jsonb_build_object(
        'attendance_date', NEW.attendance_date::text,
        'absent_students', jsonb_build_array(
          jsonb_build_object(
            'student_id', NEW.student_id::text,
            'student_name', student_name,
            'status', st
          )
        )
      );

      SELECT * INTO http_result
      FROM net.http_post(
        url := supabase_url || '/functions/v1/notify-parent-absence',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', cron_secret
        ),
        body := payload::text,
        timeout_milliseconds := 5000
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- pg_net not available or network error: log and continue
    RAISE NOTICE 'notify_parent_on_absence: pg_net call failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_parent_absence ON public.attendance;
CREATE TRIGGER trg_notify_parent_absence
  AFTER INSERT OR UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_parent_on_absence();
