DROP FUNCTION IF EXISTS public.notify_on_face_scan() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_on_face_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  student_name TEXT;
  cls_id UUID;
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
      parent_uid,
      scan_label,
      COALESCE(student_name,'') || ' มาถึงโรงเรียนเรียบร้อย เวลา ' || to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok', 'HH24:MI'),
      'face_scan', 'face_scan_log', NEW.id
    );
  END LOOP;

  -- Notify homeroom teacher
  IF cls_id IS NOT NULL THEN
    SELECT teacher_user_id INTO homeroom_uid
    FROM public.classrooms WHERE id = cls_id;
    IF homeroom_uid IS NOT NULL AND homeroom_uid <> COALESCE(NEW.scanned_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
      VALUES (
        homeroom_uid, scan_label,
        COALESCE(student_name,'') || ' สแกนหน้า เวลา ' || to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok', 'HH24:MI'),
        'face_scan', 'face_scan_log', NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_face_scan ON public.face_scan_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_face_scan
AFTER INSERT ON public.face_scan_logs
FOR EACH ROW EXECUTE FUNCTION public.notify_on_face_scan()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
