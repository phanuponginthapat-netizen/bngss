-- 1) Face scan → Google Chat
CREATE OR REPLACE FUNCTION public.gchat_on_face_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sname text;
  cls_name text;
  scan_label text;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name), c.class_name
    INTO sname, cls_name
    FROM public.students s
    LEFT JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.id = NEW.student_id;

  scan_label := CASE NEW.scan_type
    WHEN 'entry' THEN '🚪 เข้าโรงเรียน'
    WHEN 'exit' THEN '🏃 ออกจากโรงเรียน'
    WHEN 'assembly' THEN '🇹🇭 เช็คชื่อหน้าเสาธง'
    ELSE '📷 สแกนหน้า'
  END;

  PERFORM public.notify_google_chat(
    'face_scan',
    scan_label || ': ' || COALESCE(sname,'-'),
    'ห้อง ' || COALESCE(cls_name,'-') || ' เวลา ' ||
      to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok','HH24:MI'),
    'student_affairs','info', NULL,
    jsonb_build_object(
      'ประเภท', scan_label,
      'วันที่', to_char(NEW.scan_date,'DD/MM/YYYY')
    ),
    'face_scan_logs', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gchat_on_face_scan ON public.face_scan_logs;
CREATE TRIGGER trg_gchat_on_face_scan
AFTER INSERT ON public.face_scan_logs
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_face_scan();

-- 2) Attendance (absent) → Google Chat
CREATE OR REPLACE FUNCTION public.gchat_on_absence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sname text;
  cls_name text;
BEGIN
  IF NEW.status <> 'absent' THEN RETURN NEW; END IF;

  SELECT CONCAT(prefix, first_name, ' ', last_name), c.class_name
    INTO sname, cls_name
    FROM public.students s
    LEFT JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.id = NEW.student_id;

  PERFORM public.notify_google_chat(
    'attendance_absent',
    '📌 ขาดเรียน: ' || COALESCE(sname,'-'),
    'ห้อง ' || COALESCE(cls_name,'-') || ' วันที่ ' ||
      to_char(NEW.attendance_date,'DD/MM/YYYY'),
    'student_affairs','warning', NULL,
    jsonb_build_object(
      'หมายเหตุ', COALESCE(NEW.notes,'-')
    ),
    'attendance', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gchat_on_absence ON public.attendance;
CREATE TRIGGER trg_gchat_on_absence
AFTER INSERT OR UPDATE OF status ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_absence();

-- 3) Behavior records (all types) → Google Chat
-- (มี gchat_on_serious_behavior อยู่แล้วสำหรับลบ ≥5 คะแนน เก็บไว้เพื่อ severity warning)
CREATE OR REPLACE FUNCTION public.gchat_on_behavior_any()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sname text;
  emoji text;
  type_label text;
  sev text;
BEGIN
  -- ข้ามถ้าเป็นพฤติกรรมร้ายแรง (มี trigger เฉพาะอยู่แล้ว)
  IF NEW.behavior_type = 'negative' AND COALESCE(ABS(NEW.points),0) >= 5 THEN
    RETURN NEW;
  END IF;

  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO sname
    FROM public.students WHERE id = NEW.student_id;

  IF NEW.behavior_type = 'positive' THEN
    emoji := '⭐'; type_label := 'พฤติกรรมดี'; sev := 'success';
  ELSIF NEW.behavior_type = 'negative' THEN
    emoji := '⚠️'; type_label := 'พฤติกรรมที่ควรปรับปรุง'; sev := 'info';
  ELSE
    emoji := '📝'; type_label := 'บันทึกพฤติกรรม'; sev := 'info';
  END IF;

  PERFORM public.notify_google_chat(
    'behavior',
    emoji || ' ' || type_label || ': ' || COALESCE(sname,'-'),
    COALESCE(NEW.description,''),
    'student_affairs', sev, NULL,
    jsonb_build_object(
      'คะแนน', COALESCE(NEW.points::text,'0'),
      'วันที่', to_char(NEW.record_date,'DD/MM/YYYY')
    ),
    'behavior_records', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gchat_on_behavior_any ON public.behavior_records;
CREATE TRIGGER trg_gchat_on_behavior_any
AFTER INSERT ON public.behavior_records
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_behavior_any();

-- 4) Score records → Google Chat (วิชาการ)
CREATE OR REPLACE FUNCTION public.gchat_on_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sname text;
  subj_name text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.grade IS NOT DISTINCT FROM OLD.grade
     AND NEW.total_score IS NOT DISTINCT FROM OLD.total_score THEN
    RETURN NEW;
  END IF;

  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO sname
    FROM public.students WHERE student_code = NEW.student_code LIMIT 1;
  SELECT subject_name INTO subj_name FROM public.subjects WHERE id = NEW.subject_id;

  PERFORM public.notify_google_chat(
    'score',
    '📊 บันทึกผลคะแนน: ' || COALESCE(sname, NEW.student_code),
    'วิชา ' || COALESCE(subj_name,'-'),
    'academic','info', NULL,
    jsonb_build_object(
      'คะแนนรวม', COALESCE(NEW.total_score::text,'-'),
      'เกรด', COALESCE(NEW.grade,'-')
    ),
    'student_scores', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gchat_on_score ON public.student_scores;
CREATE TRIGGER trg_gchat_on_score
AFTER INSERT OR UPDATE ON public.student_scores
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_score();