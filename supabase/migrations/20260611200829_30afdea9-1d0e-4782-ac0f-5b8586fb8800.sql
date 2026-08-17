DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS on_notification_send_line ON public.notifications';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
CREATE OR REPLACE FUNCTION public.notify_on_student_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  student_name text;
  classroom_homeroom_id uuid;
  classroom_homeroom_2_id uuid;
BEGIN
  SELECT CONCAT(s.prefix, s.first_name, ' ', s.last_name), c.homeroom_teacher_id, c.homeroom_teacher_2_id
    INTO student_name, classroom_homeroom_id, classroom_homeroom_2_id
  FROM public.students s
  LEFT JOIN public.classrooms c ON c.id = s.classroom_id
  WHERE s.id = NEW.student_id;

  FOR recipient_id IN
    SELECT DISTINCT user_id
    FROM (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('admin', 'director')

      UNION

      SELECT classroom_homeroom_id AS user_id
      WHERE classroom_homeroom_id IS NOT NULL

      UNION

      SELECT classroom_homeroom_2_id AS user_id
      WHERE classroom_homeroom_2_id IS NOT NULL
    ) recipients
    WHERE user_id IS NOT NULL
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
$$;
