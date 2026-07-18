
CREATE OR REPLACE FUNCTION public.notify_on_face_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  student_name TEXT;
  cls_id UUID;
  homeroom_name TEXT;
  homeroom_uid UUID;
  parent_uid UUID;
  scan_label TEXT;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name), classroom_id
    INTO student_name, cls_id
  FROM public.students WHERE id = NEW.student_id;

  scan_label := CASE NEW.scan_type
    WHEN 'entry' THEN '🚪 เข้าโรงเรียน'
    WHEN 'exit' THEN '🏃 ออกจากโรงเรียน'
    WHEN 'assembly' THEN '🇹🇭 เช็คชื่อหน้าเสาธง'
    ELSE '📷 สแกนหน้า'
  END;

  -- Notify parents
  FOR parent_uid IN
    SELECT parent_user_id FROM public.parent_student_links WHERE student_id = NEW.student_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      parent_uid, scan_label,
      COALESCE(student_name,'') || ' มาถึงโรงเรียนเรียบร้อย เวลา ' || to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok', 'HH24:MI'),
      'face_scan', 'face_scan_log', NEW.id
    );
  END LOOP;

  -- Notify homeroom teacher via personnel match
  IF cls_id IS NOT NULL THEN
    SELECT homeroom_teacher INTO homeroom_name FROM public.classrooms WHERE id = cls_id;
    IF homeroom_name IS NOT NULL THEN
      SELECT user_id INTO homeroom_uid FROM public.personnel
        WHERE CONCAT(prefix, first_name, ' ', last_name) = homeroom_name
          OR CONCAT(first_name, ' ', last_name) = homeroom_name
        LIMIT 1;
      IF homeroom_uid IS NOT NULL AND homeroom_uid <> COALESCE(NEW.scanned_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
        VALUES (
          homeroom_uid, scan_label,
          COALESCE(student_name,'') || ' สแกนหน้าเวลา ' || to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok', 'HH24:MI'),
          'face_scan', 'face_scan_log', NEW.id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
