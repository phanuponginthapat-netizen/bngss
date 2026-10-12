-- 1) หยุดแจ้งครูประจำชั้นทุกครั้งที่นักเรียนสแกน (นักเรียน/ผู้ปกครองยังได้รับเหมือนเดิม)
CREATE OR REPLACE FUNCTION public.notify_on_face_scan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  student_name text; s_code text; s_auth uuid;
  scan_label text; msg_body text; parent_uid uuid;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name), student_code, auth_user_id
    INTO student_name, s_code, s_auth
    FROM public.students WHERE id = NEW.student_id;

  scan_label := CASE NEW.scan_type
    WHEN 'entry' THEN '🚪 เข้าโรงเรียน'
    WHEN 'exit' THEN '🏃 ออกจากโรงเรียน'
    WHEN 'assembly' THEN '🇹🇭 เช็คชื่อหน้าเสาธง'
    ELSE '📷 สแกนหน้า' END;
  msg_body := COALESCE(student_name,'')||' เวลา '||to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok','HH24:MI');

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

  IF s_auth IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (s_auth, scan_label, msg_body, 'face_scan', 'face_scan_log', NEW.id);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;

-- 2) สรุปการมาโรงเรียนรายห้อง ส่งครูประจำชั้นวันละ 1 ครั้ง
CREATE OR REPLACE FUNCTION public.notify_homeroom_daily_summary(_date date DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c record; uid uuid; total int; came int; late int; absent int; sent int := 0; msg text;
BEGIN
  -- วันหยุด/ไม่มีการสแกนทั้งโรงเรียน → ไม่ส่ง
  IF NOT EXISTS (SELECT 1 FROM face_scan_logs WHERE scan_date = _date AND scan_type = 'entry') THEN
    RETURN 0;
  END IF;

  FOR c IN SELECT id, name, homeroom_teacher, homeroom_teacher_2, homeroom_teacher_id, homeroom_teacher_2_id FROM classrooms LOOP
    SELECT count(*) INTO total FROM students s
     WHERE s.classroom_id = c.id
       AND COALESCE(s.status,'active') NOT IN ('graduated','transferred','dropped','resigned','inactive');
    CONTINUE WHEN total = 0;

    SELECT count(DISTINCT f.student_id) INTO came FROM face_scan_logs f JOIN students s ON s.id = f.student_id
     WHERE s.classroom_id = c.id AND f.scan_date = _date AND f.scan_type = 'entry';
    SELECT count(DISTINCT a.student_id) INTO late FROM attendance a JOIN students s ON s.id = a.student_id
     WHERE s.classroom_id = c.id AND a.attendance_date = _date AND a.subject_id IS NULL AND a.status = 'late';
    absent := GREATEST(total - came, 0);

    msg := 'มา '||came||'/'||total||' คน • สาย '||late||' • ยังไม่สแกน '||absent;

    FOR uid IN
      SELECT DISTINCT p.user_id FROM personnel p
       WHERE p.user_id IS NOT NULL AND (
         p.id IN (c.homeroom_teacher_id, c.homeroom_teacher_2_id)
         OR CONCAT(p.prefix, p.first_name, ' ', p.last_name) IN (c.homeroom_teacher, c.homeroom_teacher_2)
         OR CONCAT(p.first_name, ' ', p.last_name) IN (c.homeroom_teacher, c.homeroom_teacher_2))
    LOOP
      IF NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = uid AND n.type = 'homeroom_summary'
                      AND n.reference_id = c.id AND (n.created_at AT TIME ZONE 'Asia/Bangkok')::date = _date) THEN
        INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
        VALUES (uid, '📋 สรุปการมาเรียน '||c.name, msg, 'homeroom_summary', 'classroom', c.id);
        sent := sent + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN sent;
END $function$;

REVOKE ALL ON FUNCTION public.notify_homeroom_daily_summary(date) FROM PUBLIC, anon, authenticated;

-- 3) ตั้งเวลา 09:00 น. (เวลาไทย) วันจันทร์–ศุกร์
SELECT cron.unschedule('homeroom-daily-summary') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'homeroom-daily-summary');
SELECT cron.schedule('homeroom-daily-summary', '0 2 * * 1-5', $$SELECT public.notify_homeroom_daily_summary();$$);
