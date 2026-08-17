DROP FUNCTION IF EXISTS public.notify_on_student_leave() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_on_student_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipient_id uuid;
  student_name text;
  classroom_homeroom_id uuid;
  classroom_homeroom_2_id uuid;
  ht1_user uuid;
  ht2_user uuid;
BEGIN
  SELECT CONCAT(s.prefix, s.first_name, ' ', s.last_name), c.homeroom_teacher_id, c.homeroom_teacher_2_id
    INTO student_name, classroom_homeroom_id, classroom_homeroom_2_id
  FROM public.students s
  LEFT JOIN public.classrooms c ON c.id = s.classroom_id
  WHERE s.id = NEW.student_id;

  -- homeroom_teacher_id อาจเป็น personnel.id (ไม่ใช่ auth.users.id) → แปลงเป็น user_id
  IF classroom_homeroom_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = classroom_homeroom_id) THEN
      ht1_user := classroom_homeroom_id;
    ELSE
      SELECT user_id INTO ht1_user FROM public.personnel WHERE id = classroom_homeroom_id;
    END IF;
  END IF;
  IF classroom_homeroom_2_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = classroom_homeroom_2_id) THEN
      ht2_user := classroom_homeroom_2_id;
    ELSE
      SELECT user_id INTO ht2_user FROM public.personnel WHERE id = classroom_homeroom_2_id;
    END IF;
  END IF;

  FOR recipient_id IN
    SELECT DISTINCT user_id
    FROM (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('admin', 'director')

      UNION

      SELECT ht1_user AS user_id WHERE ht1_user IS NOT NULL

      UNION

      SELECT ht2_user AS user_id WHERE ht2_user IS NOT NULL
    ) recipients
    WHERE user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = recipients.user_id)
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      recipient_id,
      'นักเรียนลา: ' || COALESCE(student_name, 'ไม่ระบุ'),
      COALESCE(student_name, '') || ' ลา' || NEW.leave_type || ' ' || NEW.start_date || ' - ' || NEW.end_date,
      'leave',
      'student_leave',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;