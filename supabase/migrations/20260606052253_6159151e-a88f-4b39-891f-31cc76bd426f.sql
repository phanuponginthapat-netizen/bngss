DROP FUNCTION IF EXISTS public.send_line_to_student_parents(uuid, text, text, text) CASCADE;
CREATE OR REPLACE FUNCTION public.send_line_to_student_parents(_student_id uuid, _title text, _message text, _image_url text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ids text[];
  supabase_url text;
  service_key text;
  auto_push_enabled text;
  img text;
BEGIN
  SELECT setting_value INTO auto_push_enabled
    FROM public.school_settings WHERE setting_key = 'line_auto_push_enabled' LIMIT 1;
  IF auto_push_enabled IS DISTINCT FROM 'true' THEN RETURN; END IF;

  SELECT ARRAY(SELECT x FROM unnest(ARRAY[line_user_id, line_user_id_2, line_user_id_3]) x WHERE x IS NOT NULL AND x <> '')
    INTO ids FROM public.students WHERE id = _student_id;
  IF ids IS NULL OR array_length(ids,1) IS NULL THEN RETURN; END IF;

  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.service_role_key', true);
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN; END IF;

  -- only forward https URLs (LINE doesn't accept data: URLs)
  IF _image_url IS NOT NULL AND _image_url LIKE 'https://%' THEN
    img := _image_url;
  ELSE
    img := NULL;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/notify-line',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
      body := jsonb_build_object(
        'message', COALESCE(_title,'') || E'\n' || COALESCE(_message,''),
        'title', _title,
        'line_user_ids', to_jsonb(ids),
        'image_url', img,
        'use_flex', true,
        'severity', 'info'
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $function$;
-- Update face scan trigger to forward captured face URL
DROP FUNCTION IF EXISTS public.notify_on_face_scan() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_on_face_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE student_name text; cls_id uuid; homeroom_name text; homeroom_uid uuid; scan_label text; msg_body text;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name), classroom_id INTO student_name, cls_id
    FROM public.students WHERE id = NEW.student_id;
  scan_label := CASE NEW.scan_type
    WHEN 'entry' THEN '🚪 เข้าโรงเรียน' WHEN 'exit' THEN '🏃 ออกจากโรงเรียน'
    WHEN 'assembly' THEN '🇹🇭 เช็คชื่อหน้าเสาธง' ELSE '📷 สแกนหน้า' END;
  msg_body := COALESCE(student_name,'')||' เวลา '||to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok','HH24:MI');

  PERFORM public.send_line_to_student_parents(NEW.student_id, scan_label, msg_body, NEW.captured_face_url);

  IF cls_id IS NOT NULL THEN
    SELECT homeroom_teacher INTO homeroom_name FROM public.classrooms WHERE id = cls_id;
    IF homeroom_name IS NOT NULL THEN
      SELECT user_id INTO homeroom_uid FROM public.personnel
        WHERE CONCAT(prefix, first_name, ' ', last_name) = homeroom_name
           OR CONCAT(first_name, ' ', last_name) = homeroom_name LIMIT 1;
      IF homeroom_uid IS NOT NULL AND homeroom_uid <> COALESCE(NEW.scanned_by,'00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
        VALUES (homeroom_uid, scan_label, msg_body, 'face_scan','face_scan_log', NEW.id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;
