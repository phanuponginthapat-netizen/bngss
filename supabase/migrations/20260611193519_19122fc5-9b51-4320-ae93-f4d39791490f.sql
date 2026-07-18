CREATE OR REPLACE FUNCTION public.notify_on_face_scan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  student_name text;
  s_code text;
  s_auth uuid;
  cls_id uuid;
  homeroom_name text;
  homeroom_uid uuid;
  scan_label text;
  msg_body text;
  parent_uid uuid;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name), classroom_id, student_code, auth_user_id
    INTO student_name, cls_id, s_code, s_auth
    FROM public.students WHERE id = NEW.student_id;

  scan_label := CASE NEW.scan_type
    WHEN 'entry' THEN '🚪 เข้าโรงเรียน'
    WHEN 'exit' THEN '🏃 ออกจากโรงเรียน'
    WHEN 'assembly' THEN '🇹🇭 เช็คชื่อหน้าเสาธง'
    ELSE '📷 สแกนหน้า' END;
  msg_body := COALESCE(student_name,'')||' เวลา '||to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok','HH24:MI');

  -- Notify linked parents (exclude student's own profile to avoid duplicate)
  IF s_code IS NOT NULL THEN
    FOR parent_uid IN
      SELECT id FROM public.profiles
       WHERE student_code = s_code
         AND id <> COALESCE(s_auth, '00000000-0000-0000-0000-000000000000'::uuid)
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
      VALUES (parent_uid, scan_label, msg_body, 'face_scan', 'face_scan_log', NEW.id);
    END LOOP;
  END IF;

  -- Notify the student themselves
  IF s_auth IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (s_auth, scan_label, msg_body, 'face_scan', 'face_scan_log', NEW.id);
  END IF;

  -- Notify homeroom teacher
  IF cls_id IS NOT NULL THEN
    SELECT homeroom_teacher INTO homeroom_name FROM public.classrooms WHERE id = cls_id;
    IF homeroom_name IS NOT NULL THEN
      SELECT user_id INTO homeroom_uid FROM public.personnel
        WHERE CONCAT(prefix, first_name, ' ', last_name) = homeroom_name
           OR CONCAT(first_name, ' ', last_name) = homeroom_name LIMIT 1;
      IF homeroom_uid IS NOT NULL
         AND homeroom_uid <> COALESCE(NEW.scanned_by,'00000000-0000-0000-0000-000000000000'::uuid)
         AND homeroom_uid <> COALESCE(s_auth,'00000000-0000-0000-0000-000000000000'::uuid)
      THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
        VALUES (homeroom_uid, scan_label, msg_body, 'face_scan', 'face_scan_log', NEW.id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;

-- Cleanup existing duplicates from today
DELETE FROM public.notifications a
USING public.notifications b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.reference_type = 'face_scan_log'
  AND b.reference_type = 'face_scan_log'
  AND a.reference_id = b.reference_id
  AND a.title = b.title;