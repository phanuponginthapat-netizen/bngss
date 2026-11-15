CREATE OR REPLACE FUNCTION public.notify_parent_on_absence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p1 uuid; p2 uuid; pid uuid; student_name text; st text;
  supabase_url text; cron_secret text; payload jsonb; http_result record;
BEGIN
  st := NEW.status;
  IF st NOT IN ('absent','late') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT s.parent_user_id, s.parent_user_id_2, (s.first_name || ' ' || s.last_name)
    INTO p1, p2, student_name FROM public.students s WHERE s.id = NEW.student_id;
  IF p1 IS NULL AND p2 IS NULL THEN RETURN NEW; END IF;
  FOREACH pid IN ARRAY ARRAY_REMOVE(ARRAY[p1, CASE WHEN p2 IS DISTINCT FROM p1 THEN p2 END], NULL) LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, is_read)
    VALUES (pid, '📋 แจ้งเตือนการมาเรียน',
      student_name || ' — ' || CASE WHEN st='late' THEN 'มาสาย' ELSE 'ขาดเรียน' END || ' วันที่ ' || NEW.attendance_date::text,
      'attendance', NEW.id, 'attendance', false);
  END LOOP;
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
END $function$;