DROP FUNCTION IF EXISTS public.gchat_on_absence() CASCADE;
CREATE OR REPLACE FUNCTION public.gchat_on_absence()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sname text; cls_name text; link text;
BEGIN
  IF NEW.status <> 'absent' THEN RETURN NEW; END IF;
  SELECT CONCAT(prefix, first_name, ' ', last_name), c.name
    INTO sname, cls_name
    FROM public.students s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.id = NEW.student_id;
  link := public.app_base_url() || '/dashboard/student/attendance?student=' || NEW.student_id::text
    || '&date=' || to_char(NEW.attendance_date,'YYYY-MM-DD') || '&tab=history';
  PERFORM public.notify_google_chat(
    'attendance_absent',
    '📌 ขาดเรียน: ' || COALESCE(sname,'-'),
    'ห้อง ' || COALESCE(cls_name,'-') || ' วันที่ ' || to_char(NEW.attendance_date,'DD/MM/YYYY'),
    'student_affairs','warning', link,
    jsonb_build_object('หมายเหตุ', COALESCE(NEW.notes,'-')),
    'attendance', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;
DROP FUNCTION IF EXISTS public.gchat_on_face_scan() CASCADE;
CREATE OR REPLACE FUNCTION public.gchat_on_face_scan()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sname text; cls_name text; scan_label text; link text;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name), c.name
    INTO sname, cls_name
    FROM public.students s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
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
    'ห้อง ' || COALESCE(cls_name,'-') || ' เวลา ' || to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok','HH24:MI'),
    'student_affairs','info', link,
    jsonb_build_object('ประเภท', scan_label, 'วันที่', to_char(NEW.scan_date,'DD/MM/YYYY')),
    'face_scan_logs', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;
DROP FUNCTION IF EXISTS public.gchat_on_student_leave() CASCADE;
CREATE OR REPLACE FUNCTION public.gchat_on_student_leave()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sname text; cls text;
BEGIN
  SELECT CONCAT(s.prefix, s.first_name, ' ', s.last_name), c.name
    INTO sname, cls
    FROM public.students s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.id = NEW.student_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_google_chat(
      'student_leave',
      '📝 คำขอลานักเรียน: ' || COALESCE(sname,'-'),
      'ห้อง ' || COALESCE(cls,'-') || ' • ลา ' || NEW.leave_type,
      'student_affairs','info', NULL,
      jsonb_build_object(
        'ตั้งแต่', to_char(NEW.start_date,'DD/MM/YYYY'),
        'ถึง', to_char(NEW.end_date,'DD/MM/YYYY'),
        'เหตุผล', COALESCE(NEW.reason,'-')
      ),
      'student_leaves', NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.notify_google_chat(
      'student_leave',
      '✅ อนุมัติลานักเรียน: ' || COALESCE(sname,'-'),
      'ห้อง ' || COALESCE(cls,'-') || ' • ' || NEW.leave_type,
      'student_affairs','success', NULL,
      jsonb_build_object(
        'ตั้งแต่', to_char(NEW.start_date,'DD/MM/YYYY'),
        'ถึง', to_char(NEW.end_date,'DD/MM/YYYY')
      ),
      'student_leaves', NEW.id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;
DROP FUNCTION IF EXISTS public.notify_homeroom_on_ai_risk() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_homeroom_on_ai_risk()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  s_id uuid; s_name text; cls_name text; cls_id uuid;
  ht1 uuid; ht2 uuid; ht_uid uuid; flags_text text; preview text;
BEGIN
  IF NEW.role <> 'user' THEN RETURN NEW; END IF;
  IF NEW.risk_level NOT IN ('high','medium') THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT s.id, CONCAT(s.prefix, s.first_name, ' ', s.last_name),
         c.id, c.name, c.homeroom_teacher_id, c.homeroom_teacher_2_id
    INTO s_id, s_name, cls_id, cls_name, ht1, ht2
    FROM public.students s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.auth_user_id = NEW.user_id LIMIT 1;
  IF s_id IS NULL THEN RETURN NEW; END IF;
  flags_text := COALESCE(array_to_string(NEW.risk_flags, ', '), '-');
  preview := LEFT(COALESCE(NEW.content,''), 200);
  FOR ht_uid IN
    SELECT user_id FROM public.personnel WHERE id IN (ht1, ht2) AND user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      ht_uid,
      '🚨 พบความเสี่ยงจากการใช้ AI: ' || COALESCE(s_name,'นักเรียน'),
      'ห้อง ' || COALESCE(cls_name,'-') || ' • ระดับ ' || NEW.risk_level
        || ' • flags: ' || flags_text || E'\n"' || preview || '"',
      'ai_risk','ai_chat_log', NEW.id
    );
  END LOOP;
  PERFORM public.notify_google_chat(
    'ai_risk',
    '🚨 ความเสี่ยงจากการใช้ AI: ' || COALESCE(s_name,'-'),
    'ห้อง ' || COALESCE(cls_name,'-') || ' • ระดับ ' || NEW.risk_level || E'\n"' || preview || '"',
    'student_affairs',
    CASE WHEN NEW.risk_level = 'high' THEN 'critical' ELSE 'warning' END,
    public.app_base_url() || '/admin/ai-analytics',
    jsonb_build_object('flags', flags_text, 'topic', COALESCE(NEW.topic,'-')),
    'ai_chat_logs', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_homeroom_on_ai_risk failed: %', SQLERRM;
  RETURN NEW;
END $function$;
