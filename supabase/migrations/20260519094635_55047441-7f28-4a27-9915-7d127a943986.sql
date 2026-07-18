-- Helper: ดึง base URL ของแอป (ตั้งใน school_settings: app_base_url)
CREATE OR REPLACE FUNCTION public.app_base_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF((SELECT setting_value FROM public.school_settings WHERE setting_key = 'app_base_url'), ''),
    'https://id-preview--7eb2421f-d698-449d-a764-ab9f76e2bc13.lovable.app'
  );
$$;

-- 1) Face scan
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
  link text;
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

  link := public.app_base_url() || '/dashboard/student/face-scan?student=' || NEW.student_id::text
    || '&date=' || to_char(NEW.scan_date,'YYYY-MM-DD');

  PERFORM public.notify_google_chat(
    'face_scan',
    scan_label || ': ' || COALESCE(sname,'-'),
    'ห้อง ' || COALESCE(cls_name,'-') || ' เวลา ' ||
      to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok','HH24:MI'),
    'student_affairs','info', link,
    jsonb_build_object('ประเภท', scan_label, 'วันที่', to_char(NEW.scan_date,'DD/MM/YYYY')),
    'face_scan_logs', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

-- 2) Attendance (absent)
CREATE OR REPLACE FUNCTION public.gchat_on_absence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sname text;
  cls_name text;
  link text;
BEGIN
  IF NEW.status <> 'absent' THEN RETURN NEW; END IF;

  SELECT CONCAT(prefix, first_name, ' ', last_name), c.class_name
    INTO sname, cls_name
    FROM public.students s
    LEFT JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.id = NEW.student_id;

  link := public.app_base_url() || '/dashboard/student/attendance?student=' || NEW.student_id::text
    || '&date=' || to_char(NEW.attendance_date,'YYYY-MM-DD') || '&tab=history';

  PERFORM public.notify_google_chat(
    'attendance_absent',
    '📌 ขาดเรียน: ' || COALESCE(sname,'-'),
    'ห้อง ' || COALESCE(cls_name,'-') || ' วันที่ ' ||
      to_char(NEW.attendance_date,'DD/MM/YYYY'),
    'student_affairs','warning', link,
    jsonb_build_object('หมายเหตุ', COALESCE(NEW.notes,'-')),
    'attendance', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

-- 3) Behavior records (any)
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
  link text;
BEGIN
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

  link := public.app_base_url() || '/dashboard/student/behavior?student=' || NEW.student_id::text;

  PERFORM public.notify_google_chat(
    'behavior',
    emoji || ' ' || type_label || ': ' || COALESCE(sname,'-'),
    COALESCE(NEW.description,''),
    'student_affairs', sev, link,
    jsonb_build_object(
      'คะแนน', COALESCE(NEW.points::text,'0'),
      'วันที่', to_char(NEW.record_date,'DD/MM/YYYY')
    ),
    'behavior_records', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

-- 4) Score → ปพ.5
CREATE OR REPLACE FUNCTION public.gchat_on_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sname text;
  subj_name text;
  link text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.grade IS NOT DISTINCT FROM OLD.grade
     AND NEW.total_score IS NOT DISTINCT FROM OLD.total_score THEN
    RETURN NEW;
  END IF;

  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO sname
    FROM public.students WHERE student_code = NEW.student_code LIMIT 1;
  SELECT subject_name INTO subj_name FROM public.subjects WHERE id = NEW.subject_id;

  link := public.app_base_url() || '/dashboard/academic/pp5?student_code=' || NEW.student_code
    || COALESCE('&subject=' || NEW.subject_id::text, '');

  PERFORM public.notify_google_chat(
    'score',
    '📊 บันทึกผลคะแนน: ' || COALESCE(sname, NEW.student_code),
    'วิชา ' || COALESCE(subj_name,'-'),
    'academic','info', link,
    jsonb_build_object(
      'คะแนนรวม', COALESCE(NEW.total_score::text,'-'),
      'เกรด', COALESCE(NEW.grade,'-')
    ),
    'student_scores', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;