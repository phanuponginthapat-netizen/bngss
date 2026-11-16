DROP TRIGGER IF EXISTS trg_notify_on_face_scan ON public.face_scan_logs;

CREATE OR REPLACE FUNCTION public.notify_on_face_scan()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  student_name text; s_code text; s_auth uuid; cls_id uuid; p1 uuid; p2 uuid;
  homeroom_name text; homeroom_uid uuid; scan_label text; msg_body text; parent_uid uuid;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name), classroom_id, student_code, auth_user_id, parent_user_id, parent_user_id_2
    INTO student_name, cls_id, s_code, s_auth, p1, p2
    FROM public.students WHERE id = NEW.student_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  scan_label := CASE NEW.scan_type
    WHEN 'entry' THEN '🚪 เข้าโรงเรียน' WHEN 'exit' THEN '🏃 ออกจากโรงเรียน'
    WHEN 'assembly' THEN '🇹🇭 เช็คชื่อหน้าเสาธง' ELSE '📷 สแกนหน้า' END;
  msg_body := COALESCE(student_name,'')||' เวลา '||to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok','HH24:MI');

  FOR parent_uid IN
    SELECT DISTINCT u FROM (
      SELECT p1 AS u UNION SELECT p2
      UNION SELECT id FROM public.profiles WHERE s_code IS NOT NULL AND student_code = s_code
    ) x
    WHERE u IS NOT NULL AND u <> COALESCE(s_auth,'00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (parent_uid, scan_label, msg_body, 'face_scan', 'face_scan_log', NEW.id);
  END LOOP;

  IF s_auth IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (s_auth, scan_label, msg_body, 'face_scan', 'face_scan_log', NEW.id);
  END IF;

  IF cls_id IS NOT NULL THEN
    SELECT homeroom_teacher INTO homeroom_name FROM public.classrooms WHERE id = cls_id;
    IF homeroom_name IS NOT NULL THEN
      SELECT user_id INTO homeroom_uid FROM public.personnel
        WHERE CONCAT(prefix, first_name, ' ', last_name) = homeroom_name
           OR CONCAT(first_name, ' ', last_name) = homeroom_name LIMIT 1;
      IF homeroom_uid IS NOT NULL AND homeroom_uid <> COALESCE(s_auth,'00000000-0000-0000-0000-000000000000'::uuid)
         AND homeroom_uid IS DISTINCT FROM p1 AND homeroom_uid IS DISTINCT FROM p2 THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
        VALUES (homeroom_uid, scan_label, msg_body, 'face_scan', 'face_scan_log', NEW.id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;

-- Backfill today's scans for linked parents who missed them
INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id, created_at)
SELECT pu, CASE f.scan_type WHEN 'entry' THEN '🚪 เข้าโรงเรียน' WHEN 'exit' THEN '🏃 ออกจากโรงเรียน' WHEN 'assembly' THEN '🇹🇭 เช็คชื่อหน้าเสาธง' ELSE '📷 สแกนหน้า' END,
  CONCAT(s.prefix, s.first_name, ' ', s.last_name)||' เวลา '||to_char(f.scan_time AT TIME ZONE 'Asia/Bangkok','HH24:MI'),
  'face_scan','face_scan_log', f.id, f.created_at
FROM public.face_scan_logs f
JOIN public.students s ON s.id = f.student_id
CROSS JOIN LATERAL (VALUES (s.parent_user_id),(s.parent_user_id_2)) v(pu)
WHERE pu IS NOT NULL AND pu IS DISTINCT FROM s.auth_user_id
  AND (f.scan_time AT TIME ZONE 'Asia/Bangkok')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date
  AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = pu AND n.reference_id = f.id);