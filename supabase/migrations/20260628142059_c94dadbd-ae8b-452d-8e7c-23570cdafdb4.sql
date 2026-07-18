-- 1) Add deadline & window toggle
ALTER TABLE public.incomplete_grade_reports
  ADD COLUMN IF NOT EXISTS fix_deadline date;

ALTER TABLE public.academic_periods
  ADD COLUMN IF NOT EXISTS fix_window_open boolean NOT NULL DEFAULT true;

-- 2) Reminder function: notify pending reports near deadline
CREATE OR REPLACE FUNCTION public.remind_incomplete_grades()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  days_left int;
  msg_title text;
  msg_body text;
  sent_count int := 0;
  parent_user uuid;
  teacher_user uuid;
BEGIN
  FOR rec IN
    SELECT r.id, r.student_id, r.grade_type, r.fix_deadline,
           r.subject_name_text, r.academic_year, r.semester,
           s.user_id AS student_user, s.parent_user_id, s.parent_user_id_2,
           p.user_id AS teacher_user
    FROM public.incomplete_grade_reports r
    JOIN public.students s ON s.id = r.student_id
    LEFT JOIN public.personnel p ON p.id = r.teacher_id
    WHERE r.status = 'pending'
      AND r.fix_deadline IS NOT NULL
      AND (r.fix_deadline - current_date) IN (14, 7, 3, 1, 0, -1)
  LOOP
    days_left := rec.fix_deadline - current_date;
    msg_title := CASE
      WHEN days_left < 0 THEN 'เลยกำหนดแก้คะแนน ' || rec.grade_type
      WHEN days_left = 0 THEN 'วันสุดท้ายแก้คะแนน ' || rec.grade_type
      ELSE 'เตือน: เหลือ ' || days_left || ' วันแก้คะแนน ' || rec.grade_type
    END;
    msg_body := 'วิชา ' || COALESCE(rec.subject_name_text, '-') 
                || ' ปีการศึกษา ' || rec.academic_year || '/' || rec.semester
                || ' กำหนดส่ง ' || to_char(rec.fix_deadline, 'DD/MM/YYYY');

    -- Student
    IF rec.student_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
      VALUES (rec.student_user, msg_title, msg_body, 'academic', rec.id, 'incomplete_grade_report');
      sent_count := sent_count + 1;
    END IF;
    -- Parents
    FOREACH parent_user IN ARRAY ARRAY[rec.parent_user_id, rec.parent_user_id_2]::uuid[] LOOP
      IF parent_user IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
        VALUES (parent_user, msg_title, msg_body || ' (บุตรหลานของท่าน)', 'academic', rec.id, 'incomplete_grade_report');
        sent_count := sent_count + 1;
      END IF;
    END LOOP;
    -- Teacher
    IF rec.teacher_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
      VALUES (rec.teacher_user, msg_title, msg_body || ' (นักเรียนของท่าน)', 'academic', rec.id, 'incomplete_grade_report');
      sent_count := sent_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('notifications_sent', sent_count, 'run_at', now());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remind_incomplete_grades() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remind_incomplete_grades() TO service_role;

-- 3) Schedule daily 07:00 Asia/Bangkok = 00:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('remind-incomplete-grades-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'remind-incomplete-grades-daily',
  '0 0 * * *',
  $$ SELECT public.remind_incomplete_grades(); $$
);